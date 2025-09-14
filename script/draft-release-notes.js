const execSync = require('child_process').execSync

const noteReg = /Release Notes:([\s\S]+)/

// git show format spec: https://git-scm.com/docs/git-show#_pretty_formats
/** @param {string} hash */
function getCommitBody(hash) {
  const body = execSync(`git show ${hash} --stat=0 --no-patch --format="%b"`).toString('utf-8').trim()
  return body
}

/**
 * @param {string} body
 * @returns {string[] | null}
 */
function parseCommitBody(body) {
  if (!body) return null
  const cx = body.match(noteReg)
  if (!cx) return null
  const [ , notes ] = cx
  if (!notes) return null
  /** @type {string[]} */
  const result = notes.trim().split("\n").map(item=> {
    const _ = item.trim()
    if (!_.startsWith("-")) return null
    return _.replace(/^- /, "")
  }).filter(Boolean)
  if (!result.length) return null
  return result
}

/**
 * @param {string} a 
 * @param {string} b 
 * @returns 
 */
function getTwoTagCommitHashs(a, b) {
  return execSync(`git log --oneline --format="%h" ${a}...${b}`).toString('utf-8').trim().split("\n")
}

function getLatestTags(size = 2) {
  return execSync(`git tag -l --sort=-v:refname | head -${size}`).toString('utf-8').trim().split("\n")
}

/**
 * @param {string} tag 
 */
function getTagNote(tag) {
  const _ = execSync(`git show ${tag} --stat=0 --no-patch --format="%N"`).toString('utf-8').trim()
  const note = _.split("\n").filter(item=> { return !!item.trim() })
  // 第一行第二行不需要
  note.shift()
  note.shift()
  return note.join("\n") + "\n"
}

const kRepo = "waifu-project/movie"

const fastGithubDomains = [
  // https://gh-proxy.com
  { text: "全球加速", prefix: "https://gh-proxy.com" },
  { text: "香港加速", prefix: "https://hk.gh-proxy.com" },
  // https://ghproxy.link
  { text: "加速3", prefix: "https://ghfast.top" },
  { text: "原始", prefix: null },
]

function buildFastLink(fastPrefix, tag, file) {
  const raw = `https://github.com/${kRepo}/releases/download/${tag}/${file}`
  if (!fastPrefix) return raw
  return `${fastPrefix}/${raw}`
}

function buildRealFastLink(tag, file) {
  return fastGithubDomains.map((item)=> {
    const link = buildFastLink(item.prefix, tag, file)
    return `[${item.text}](${link})`
  }).join(" \\| ")
}

function buildReleaseHeader(tag) {
  const _ = (file)=> buildRealFastLink(tag, file)
return `
## 🐱 小猫影视

| 系统     | 文件后缀 | 架构          | 下载链接 |
|---------|------|-------------|------|
| macOS   | .zip | 通用(universal)   |  ${_('catmovie-mac.zip')}  |
| iOS     | .ipa | -           |  ${_('catmovie.ipa')}    |   |   |
| Android | .apk | 常用(arm64-v8a)   |  ${_('catmovie.apk')}    |   |
| Android | .apk | 旧手机(armeabi-v7a) |  ${_('catmovie-legacy.apk')}   |
| Android | .apk | 通用(universal)   |  ${_('catmovie-universal.apk')}    |
| Windows | .zip | -            |  ${_('catmovie-windows.zip')}    |   |
| Linux   | .zip | -            | ${_('catmovie-linux-x86_64.tar.gz')}     |
`
}

function buildRealNotes(tag, changelog) {
  const header = buildReleaseHeader(tag)
  return `
${header}  
## 📢 更新日志

${changelog}
`
}

const val = buildReleaseHeader('release-v2.5.6')
console.log(val)

;(async()=> {
  const token = process.env.GITHUB_TOKEN
  const resp = await fetch(`https://api.github.com/repos/${kRepo}/tags`, {
    headers: {
      "Authorization": `Bearer ${token}`
    }
  })
  /** @type {GithubTagResponse} */
  const tags = await resp.json()
  const now = tags[0].name
  const old = tags[1].name//我赌你枪里没有子弹
  // const tags = getLatestTags() 
  const hashs = getTwoTagCommitHashs(now, old)
  let notes = []
  for (const hash of hashs) {
    const body = getCommitBody(hash)
    const _ = parseCommitBody(body)
    if (_) {
      notes = [...notes, ..._]
    }
  }
  let releaseNote = getTagNote(now)
  releaseNote += notes.map(item=> `- ${item}`).join("\n")
  const note = buildRealNotes(now, releaseNote)
  console.log(note)
})()