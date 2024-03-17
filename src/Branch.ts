import type { D1 } from './D1.js'

const checkError = (response: {
  success: boolean
  errors: {
    code: string
    message: string
  }[]
}) => {
  if (!response.success) {
    throw new Error(
      response.errors.map((e) => `${e.code}: ${e.message}`).join('\n')
    )
  }
}

export class Branch {
  query: ReturnType<ReturnType<typeof D1>['prepare']>['query']
  delete: ReturnType<ReturnType<typeof D1>['prepare']>['delete']
  get: ReturnType<ReturnType<typeof D1>['prepare']>['get']
  private name

  constructor(d1: ReturnType<ReturnType<typeof D1>['prepare']>, name: string) {
    this.query = d1.query
    this.delete = d1.delete
    this.get = d1.get
    this.name = name
  }

  // https://developers.cloudflare.com/d1/reference/database-commands/
  async get_schema() {
    const table_list = await this.query<{
      schema: string
      name: string
      type: string
      ncol: number
      wr: number
      strict: number
    }>(`PRAGMA table_list`)

    const tables = table_list.result
      .flatMap((table) => table.results)
      .filter((table) => table.name.startsWith(this.name))

    const map = await Promise.all(
      tables.map(async (table) => {
        const [table_info, index_list] = await Promise.all([
          this.query<{
            cid: number
            name: string
            type: string
            notnull: number
            dflt_value: string
            pk: number
          }>(`PRAGMA table_info(?)`, [table.name]),
          this.query<{
            seq: number
            name: string
            unique: number
            origin: string
            partial: number
          }>(`PRAGMA index_list(?)`, [table.name])
        ])

        return [
          table.name,
          {
            table,
            table_info: table_info.result.flatMap((column) => column.results),
            index_list: index_list.result.flatMap((index) => index.results)
          }
        ] as const
      })
    )

    return new Map(map)
  }

  mergeTo(base: Branch) {}

  diffFrom(base: Branch) {}
}
