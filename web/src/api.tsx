export class ApiRequest {
  private baseUrl: string
  private path: string
  private init: RequestInit

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.path = ""
    this.init = {
      headers: {},
      credentials: "include",
    }
  }

  get(path: string) {
    this.init.method = "GET"
    this.path = path
    return this
  }

  body(body: any = null) {
    if (body) {
      this.init.body = JSON.stringify(body)
    }
  }

  post(path: string, body: any = null) {
    this.init.method = "POST"
    this.body(body)
    this.path = path
    return this
  }

  put(path: string, body: any = null) {
    this.init.method = "PUT"
    this.body(body)
    this.path = path
    return this
  }

  response() {
    return {
      json: <D = any,>() => {
        this.init.headers = {
          ...(this.init.headers ?? {}),
          "Content-Type": "application/json",
        }
        return fetch(`${this.baseUrl}${this.path}`, this.init).then(
          (res) => res.json() as Promise<D>,
        )
      },
      do: <D = any,>() => {
        return fetch(`${this.baseUrl}${this.path}`, this.init).then(
          (res) => res.json() as Promise<D>,
        )
      },
    }
  }
}
