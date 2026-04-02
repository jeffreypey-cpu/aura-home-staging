import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = 'http://127.0.0.1:8000'

async function handler(request: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/')
  const search = request.nextUrl.search || ''
  const url = `${BACKEND_URL}/api/${path}${search}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  let body: string | FormData | undefined = undefined

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body = formData as any
      delete headers['Content-Type']
    } else {
      body = await request.text()
    }
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body,
  })

  const responseText = await response.text()

  return new NextResponse(responseText, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    },
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
