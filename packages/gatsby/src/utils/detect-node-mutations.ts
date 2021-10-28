import type { IGatsbyNode } from "../redux/types"
import reporter from "gatsby-cli/lib/reporter"

const reported = new Set<string>()

function createProxyHandler(prefix, options): ProxyHandler<any> {
  return {
    get: function (target, key): any {
      const value = target[key]
      const path = key && key.toString ? `${prefix}.${key.toString()}` : prefix

      if (options?.ignore?.includes(path)) {
        return value
      }

      const fieldDescriptor = Object.getOwnPropertyDescriptor(target, key)
      if (fieldDescriptor && !fieldDescriptor.writable) {
        // this is to prevent errors like:
        // ```
        // TypeError: 'get' on proxy: property 'constants' is a read - only and
        // non - configurable data property on the proxy target but the proxy
        // did not return its actual value
        // (expected '[object Object]' but got '[object Object]')
        // ```
        return value
      }

      if (typeof value === `object` && value !== null) {
        return new Proxy(value, createProxyHandler(path, options))
      }

      return value
    },
    set: function (target, key, value): boolean {
      const path = key && key.toString ? `${prefix}.${key.toString()}` : prefix

      if (options?.ignore?.includes(path)) {
        target[key] = value
        return true
      }

      const error = new Error(
        `Mutating nodes is a no no, please use createNode, createNodeField and/or createParentChildLink`
      )

      if (process.env.GATSBY_DIAGNOSTICS) {
        if (!error.stack) {
          throw new Error(`No stack!`)
        } else if (!reported.has(error.stack)) {
          reporter.error(error)
          reported.add(error.stack)
        }
        return true
      }

      throw error
    },
  }
}

export function wrapNode(node: IGatsbyNode): IGatsbyNode {
  return new Proxy(
    node,
    createProxyHandler(node.internal.type, {
      ignore: [`${node.internal.type}.__gatsby_resolved`],
    })
  )
}
