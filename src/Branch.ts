import type { D1 } from './D1.js'
import { Column } from './types/Column.js'
import { IndexKey } from './types/IndexKey.js'
import { Table } from './types/Table.js'
import { TableDiff } from './types/TableDiff.js'

type Prepared = ReturnType<ReturnType<typeof D1>['prepare']>

const nonNullable = <T>(x: T): x is NonNullable<T> =>
  x !== null && x !== undefined

export class Branch {
  query: Prepared['query']
  delete: Prepared['delete']
  get: Prepared['get']

  constructor(d1: Prepared) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.query = d1.query
    this.delete = d1.delete
    this.get = d1.get
  }

  // https://developers.cloudflare.com/d1/reference/database-commands/
  async get_schema() {
    const table_list = await this.query<Table>(`PRAGMA table_list`)

    const tables = table_list.result
      .flatMap((table) => table.results)
      .filter(
        (t) =>
          t.name !== 'sqlite_schema' &&
          t.name !== '_cf_KV' &&
          t.name !== 'sqlite_temp_schema'
      )

    const map = await Promise.all(
      tables.map(async (table) => {
        const [table_info, index_list] = await Promise.all([
          this.query<Column>(`PRAGMA table_info(${table.name})`),
          this.query<IndexKey>(`PRAGMA index_list(${table.name})`)
        ])

        return [
          table.name,
          {
            table,
            columns: table_info.result.flatMap((column) => column.results),
            indexes: index_list.result.flatMap((index) => index.results)
          }
        ] as const
      })
    )

    return new Map(map)
  }

  async diffFrom(base: Branch): Promise<TableDiff> {
    const [head_schema, base_schema] = await Promise.all([
      this.get_schema(),
      base.get_schema()
    ])

    const addTables = [...head_schema.keys()]
      .filter((table) => !base_schema.has(table))
      .map((table) => head_schema.get(table))
      .filter(nonNullable)

    const dropTables = [...base_schema.keys()]
      .filter((table) => !head_schema.has(table))
      .map((table) => base_schema.get(table)?.table)
      .filter(nonNullable)

    const modifyTables = [...head_schema.keys()]
      .filter((table) => base_schema.has(table))
      .map((table) => {
        const head = head_schema.get(table)
        const base = base_schema.get(table)

        if (head === undefined || base === undefined) {
          throw new Error('Unexpected undefined')
        }

        const columnDiff = {
          addColumns: head.columns.filter(
            (column) => !base.columns.some((c) => c.name === column.name)
          ),
          dropColumns: base.columns.filter(
            (column) => !head.columns.some((c) => c.name === column.name)
          ),
          modifyColumns: head.columns.filter((column) => {
            const baseColumn = base.columns.find((c) => c.name === column.name)

            if (baseColumn === undefined) {
              return false
            }

            return (
              baseColumn.type !== column.type ||
              baseColumn.notnull !== column.notnull ||
              baseColumn.dflt_value !== column.dflt_value ||
              baseColumn.pk !== column.pk ||
              baseColumn.cid !== column.cid
            )
          })
        }

        const indexDiff = {
          addIndexes: head.indexes.filter(
            (index) => !base.indexes.some((i) => i.name === index.name)
          ),
          dropIndexes: base.indexes.filter(
            (index) => !head.indexes.some((i) => i.name === index.name)
          ),
          modifyIndexes: head.indexes.filter((index) => {
            const baseIndex = base.indexes.find((i) => i.name === index.name)

            if (baseIndex === undefined) {
              return false
            }

            return (
              baseIndex.unique !== index.unique ||
              baseIndex.origin !== index.origin ||
              baseIndex.partial !== index.partial ||
              baseIndex.seq !== index.seq
            )
          })
        }

        return {
          ...head.table,
          columnDiff,
          indexDiff
        }
      })

    return {
      addTables,
      dropTables,
      modifyTables
    }
  }

  async deploy(diff: TableDiff) {
    
  }
}
