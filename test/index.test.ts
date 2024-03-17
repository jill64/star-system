import { expect, test } from 'vitest'
import 'dotenv/config'
import { StarSystem } from '../src/StarSystem'

test('test', async () => {
  const ss = new StarSystem({
    name: 'star-system',
    accountId: process.env.ACCOUNT_ID!,
    apiKey: process.env.API_KEY!
  })

  const main = await ss.createBranch(`main-${crypto.randomUUID()}`)

  console.log('main', main)

  const list = await ss.listBranches()

  console.log('list', list)

  expect(list.length).toBe(1)

  const schema = await main.get_schema()

  console.log('schema', schema)

  const res = await main.delete()

  console.log('res', res)
})
