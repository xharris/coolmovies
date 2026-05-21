export class ApiRequest {
  private baseUrl: string
  private path: string
  private init: RequestInit

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
    this.path = ""
    this.init = {
      headers: {},
    }
  }

  get(path: string) {
    this.init.method = "GET"
    this.path = path
    return this
  }

  post(path: string, body: any) {
    this.init.method = "POST"
    this.init.body = JSON.stringify(body)
    this.path = path
    return this
  }

  response() {
    return {
      json: <D,>() => {
        this.init.headers = {
          ...(this.init.headers ?? {}),
          "Content-Type": "application/json",
        }
        return fetch(`${this.baseUrl}${this.path}`, this.init).then(
          (res) => res.json() as Promise<D>,
        )
      },
    }
  }
}
