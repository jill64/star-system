import { Branch } from './Branch.js'
import { D1 } from './D1.js'
import type { BranchParameter } from './types/BranchParameter.js'
import { CFAuthParameter } from './types/CFAuthParameter.js'

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

export class StarSystem {
  private d1
  private prefix

  constructor(
    params: CFAuthParameter & {
      name: string
    }
  ) {
    this.d1 = new D1(params)
    this.prefix = params.name
  }

  async listBranches(): Promise<Branch[]> {
    const res = await this.d1.list({
      name: `${this.prefix}_branch`
    })

    checkError(res)

    return res.result.map(
      (branch) =>
        new Branch(
          this.d1.prepareQuery(branch.uuid),
          `${this.prefix}_branch_${branch.name}`
        )
    )
  }

  async createBranch(params: BranchParameter): Promise<Branch> {
    const res = await this.d1.create(`${this.prefix}_branch_${params.name}`)

    checkError(res)

    return new Branch(
      this.d1.prepareQuery(res.result.uuid),
      `${this.prefix}_branch_${res.result.name}`
    )
  }

  async deleteBranch(uuid: string) {
    const res = await this.d1.delete(uuid)

    checkError(res)
  }

  async getBranch(uuid: string): Promise<Branch> {
    const res = await this.d1.get(uuid)

    checkError(res)

    return new Branch(
      this.d1.prepareQuery(res.result.uuid),
      `${this.prefix}_branch_${res.result.name}`
    )
  }
}
