import 'dotenv/config'
import { StarSystem } from '../src/StarSystem'

const ss = new StarSystem({
  name: 'star-system',
  accountId: process.env.ACCOUNT_ID!,
  apiKey: process.env.API_KEY!
})

try {
  const main = await ss.createBranch('main')
  await main.query('CREATE TABLE test (id INTEGER PRIMARY KEY, name INTEGER)')

  const dev = await ss.createBranch('dev')
  await dev.query('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)')

  const diff = await dev.diffFrom(main)

  console.log('diff', JSON.stringify(diff, null, 2))
} catch (e) {
  console.log('error', e)
}

const list = await ss.listBranches()

for (const branch of list) {
  const schema = await branch.get_schema()
  console.log('schema', schema)
  await branch.delete()
}
