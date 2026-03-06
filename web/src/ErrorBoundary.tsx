import { Component } from 'react'
import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: ''
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#070a1b', color: '#f5f7ff', padding: 24 }}>
          <h1>页面加载异常</h1>
          <p>已拦截运行时错误，避免白屏。请刷新后重试。</p>
          <p>{this.state.message}</p>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
