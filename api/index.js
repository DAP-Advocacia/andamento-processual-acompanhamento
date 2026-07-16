/**
 * O Bitrix24 carrega o iframe do app com uma requisição POST (com AUTH_ID etc.
 * no corpo), mas a Vercel responde 405 a POST em arquivos estáticos. Esta função
 * devolve o index.html do próprio deploy para qualquer método — o vercel.json
 * roteia todo POST para cá (GETs continuam indo direto ao estático).
 */
export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const proto = req.headers['x-forwarded-proto'] ?? 'https'

  const resposta = await fetch(`${proto}://${host}/index.html`)
  const html = await resposta.text()

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(html)
}
