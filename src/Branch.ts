import type { D1 } from './D1.js'
import { Column } from './types/Column.js'
import { ColumnDiff } from './types/ColumnDiff.js'
import { IndexDiff } from './types/IndexDiff.js'
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
          this.query<Omit<IndexKey, 'columns'>>(
            `PRAGMA index_list(${table.name})`
          )
        ])

        const indexes = await Promise.all(
          index_list.result.map(({ results }) =>
            Promise.all(
              results.map(async (index) => {
                const columns = await this.query<IndexKey['columns'][number]>(
                  `PRAGMA index_info(${index.name})`
                )

                return {
                  ...index,
                  columns: columns.result.flatMap((column) => column.results)
                }
              })
            )
          )
        )

        return [
          table.name,
          {
            table: table satisfies Table,
            columns: table_info.result.flatMap(
              (column) => column.results
            ) satisfies Column[],
            indexes: indexes.flat() satisfies IndexKey[]
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

    const addTables: TableDiff['addTables'] = [...head_schema.keys()]
      .filter((table) => !base_schema.has(table))
      .map((table) => head_schema.get(table))
      .filter(nonNullable)

    const dropTables: TableDiff['dropTables'] = [...base_schema.keys()]
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

        const columnDiff: ColumnDiff = {
          addColumns: head.columns.filter(
            (column) => !base.columns.some((c) => c.name === column.name)
          )
        }

        const indexDiff: IndexDiff = {
          addIndexes: head.indexes.filter(
            (index) => !base.indexes.some((i) => i.name === index.name)
          ),
          dropIndexes: base.indexes.filter(
            (index) => !head.indexes.some((i) => i.name === index.name)
          )
        }

        return {
          ...head.table,
          columnDiff,
          indexDiff
        } satisfies TableDiff['modifyTables'][number]
      })

    return {
      addTables,
      dropTables,
      modifyTables
    }
  }

  async mergeTo(
    base: Branch,
    callback: (
      status:
        | 'DROPPING_TABLE'
        | 'DROPPING_INDEX'
        | 'CREATING_TABLE'
        | 'CREATING_COLUMN'
        | 'CREATING_INDEX'
    ) => unknown
  ) {
    const diff = await this.diffFrom(base)

    await callback('DROPPING_TABLE')

    await Promise.all(
      diff.dropTables.map((table) => base.query(`DROP TABLE ${table.name}`))
    )

    await callback('DROPPING_INDEX')

    await Promise.all(
      diff.modifyTables.flatMap((table) =>
        table.indexDiff.dropIndexes.map((index) =>
          base.query(`DROP INDEX ${index.name}`)
        )
      )
    )

    await callback('CREATING_TABLE')

    await Promise.all(
      diff.addTables.map((table) => {
        const columns = table.columns
          .map(
            (column) =>
              `${column.name} ${column.type}${
                column.notnull ? ' NOT NULL' : ''
              }${column.dflt_value ? ` DEFAULT ${column.dflt_value}` : ''}`
          )
          .join(', ')

        return base.query(`CREATE TABLE ${table.table.name} (${columns})`)
      })
    )

    await callback('CREATING_COLUMN')

    await Promise.all(
      diff.modifyTables.flatMap((table) =>
        table.columnDiff.addColumns.map((column) =>
          base.query(
            `ALTER TABLE ${table.name} ADD COLUMN ${column.name} ${column.type}${
              column.notnull ? ' NOT NULL' : ''
            }${column.dflt_value ? ` DEFAULT ${column.dflt_value}` : ''}`
          )
        )
      )
    )

    await callback('CREATING_INDEX')

    await Promise.all(
      diff.modifyTables.flatMap((table) =>
        table.indexDiff.addIndexes.map((index) => {
          const columns = index.columns
            .map((column) => column.name)
            .join(', ')

          return base.query(
            `CREATE INDEX ${index.name} ON ${table.name} (${columns})`
          )
        })
      )
    )
  }
}
