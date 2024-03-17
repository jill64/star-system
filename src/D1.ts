import { array, boolean, isNull, number, scanner, string } from 'typescanner'
import type { Condition } from 'typescanner/dist/types/index.js'
import { CFAuthParameter } from './types/CFAuthParameter.js'

const is_message = scanner({
  code: string,
  message: string
})

const is_list_response = scanner({
  success: boolean,
  errors: array(is_message),
  messages: array(is_message),
  result: array(
    scanner({
      created_at: string,
      name: string,
      uuid: string,
      version: string
    })
  ),
  result_info: scanner({
    count: number,
    page: number,
    per_page: number,
    total_count: number
  })
})

const is_create_response = scanner({
  success: boolean,
  errors: array(is_message),
  messages: array(is_message),
  result: scanner({
    created_at: string,
    name: string,
    uuid: string,
    version: string
  })
})

const is_delete_response = scanner({
  success: boolean,
  errors: array(is_message),
  messages: array(is_message),
  result: isNull
})

const is_get_response = scanner({
  success: boolean,
  errors: array(is_message),
  messages: array(is_message),
  result: scanner({
    created_at: string,
    file_size: number,
    name: string,
    num_tables: number,
    uuid: string,
    version: string
  })
})

const is_query_response = scanner({
  success: boolean,
  errors: array(is_message),
  messages: array(is_message),
  result: array(
    scanner({
      success: boolean,
      results: array(scanner({})),
      meta: scanner({
        changed_db: boolean,
        changes: number,
        duration: number,
        last_row_id: number,
        rows_read: number,
        rows_written: number,
        size_after: number
      })
    })
  )
})

type ExtractGuardType<T> = T extends Condition<infer U> ? U : never

export class D1 {
  private account_id
  private api_key

  constructor(params: CFAuthParameter) {
    this.account_id = params.accountId
    this.api_key = params.apiKey
  }

  async list(params?: { name?: string; page?: number; per_page?: number }) {
    const { name, page, per_page } = params ?? {}

    const url = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${this.account_id}/d1/database`
    )

    if (name) {
      url.searchParams.set('name', name)
    }

    if (page) {
      url.searchParams.set('page', page.toString())
    }

    if (per_page) {
      url.searchParams.set('per_page', per_page.toString())
    }

    const res = await fetch(url.href, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.api_key}`
      }
    })

    const json = await res.json()

    if (!is_list_response(json)) {
      throw new Error('Invalid response')
    }

    return json
  }

  async create(name: string) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.account_id}/d1/database`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.api_key}`
        },
        body: JSON.stringify({ name })
      }
    )

    const json = await res.json()

    if (!is_create_response(json)) {
      throw new Error('Invalid create response')
    }

    return json
  }

  async delete(uuid: string) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.account_id}/d1/database/${uuid}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.api_key}`
        }
      }
    )

    const json = await res.json()

    if (!is_delete_response(json)) {
      throw new Error('Invalid delete response')
    }

    return json
  }

  async get(uuid: string) {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.account_id}/d1/database/${uuid}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.api_key}`
        }
      }
    )

    const json = await res.json()

    if (!is_get_response(json)) {
      throw new Error('Invalid get response')
    }

    return json
  }

  prepareQuery(uuid: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async <T extends Record<string, any>>(
      sql: string,
      params: (string | number)[] = []
    ) => {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.account_id}/d1/database/${uuid}/query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.api_key}`
          },
          body: JSON.stringify({ params, sql })
        }
      )

      const json = await res.json()

      if (!is_query_response(json)) {
        throw new Error('Invalid query response')
      }

      type QueryResponse = ExtractGuardType<typeof is_query_response>

      type QueryResult = {
        success: QueryResponse['success']
        errors: QueryResponse['errors']
        messages: QueryResponse['messages']
        result: {
          success: QueryResponse['result'][number]['success']
          results: T[]
          meta: QueryResponse['result'][number]['meta']
        }[]
      }

      return json as QueryResult
    }
  }
}
