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
            table_info: table_info.result.flatMap((column) => column.results),
            index_list: index_list.result.flatMap((index) => index.results)
          }
        ] as const
      })
    )

    return new Map(map)
  }

  // mergeTo(base: Branch) {}

  async diffFrom(base: Branch): Promise<TableDiff> {
    const [head_schema, base_schema] = await Promise.all([
      this.get_schema(),
      base.get_schema()
    ])

    const addTables = [...head_schema.keys()]
      .filter((table) => !base_schema.has(table))
      .map((table) => head_schema.get(table)?.table)
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
          addColumns: head.table_info.filter(
            (column) => !base.table_info.some((c) => c.name === column.name)
          ),
          dropColumns: base.table_info.filter(
            (column) => !head.table_info.some((c) => c.name === column.name)
          ),
          modifyColumns: head.table_info.filter((column) => {
            const baseColumn = base.table_info.find(
              (c) => c.name === column.name
            )

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
          addIndexes: head.index_list.filter(
            (index) => !base.index_list.some((i) => i.name === index.name)
          ),
          dropIndexes: base.index_list.filter(
            (index) => !head.index_list.some((i) => i.name === index.name)
          ),
          modifyIndexes: head.index_list.filter((index) => {
            const baseIndex = base.index_list.find((i) => i.name === index.name)

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
}
