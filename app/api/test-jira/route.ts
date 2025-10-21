import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ 
    message: 'Jira API is working',
    timestamp: new Date().toISOString()
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    return NextResponse.json({
      success: true,
      message: 'Jira API received data',
      receivedData: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }
}
