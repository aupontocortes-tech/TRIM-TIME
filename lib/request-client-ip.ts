/** IP do cliente final (exigido pela Asaas em tokenização/cartão). */
export function getClientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return real
  return "127.0.0.1"
}
