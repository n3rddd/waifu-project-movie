/// <reference types="node"/>

import type { load as cheerioLoad } from 'cheerio'

declare global {
  var kitty: Kitty
  var env: KittyEnv
  var req: KittyReq

  type KittyEnvParams =
    "category" |
    "page" |
    "limit" |
    "movieId" |
    "keyword" |
    "iframe"

  interface KittyEnv {
    baseUrl: string,
    params: Record<KittyEnvParams, any>,
    get<T>(key: KittyEnvParams, defaultValue?: T): T
  }

  interface Kitty {
    load: typeof cheerioLoad
  }

  interface KittyRequestOptions {
    url?: string
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
    headers?: Record<string, string>
    params?: Record<string, any>
    data?: any
  }

  interface KittyReq {
    // req(url)
    (url: string): Promise<string>
    // req(url, options)
    (url: string, options: Partial<KittyRequestOptions>): Promise<string>
    // req(options)
    (options: KittyRequestOptions): Promise<string>
  }

  interface ICategory {
    text: string
    id: string
  }

  interface IPlaylist {
    text: string
    url?: string
    id?: string
  }

  interface IMovie {
    id: string
    title: string
    cover: string
    remark: string
    desc?: string
    playlist: Array<IPlaylist>
  }

  interface IconfigExtraJS {
    category: string
    home: string
    search: string
    detail: string
    parseIframe: string
  }

  interface IconfigExtra {
    jiexiUrl?: string
    js?: IconfigExtraJS
  }

  // TODO(d1y): update movie/schema/*.json
  interface Iconfig {
    id: string
    name: string
    type: 0 | 1
    api: string
    nsfw: boolean
    logo?: string
    desc?: string
    extra?: IconfigExtra
  }

  type HandleConfig = () => Iconfig
  type HandleCategory = () => Promise<ICategory[]>
  type HandleHome = () => Promise<IMovie[]>
  type HandleDetail = () => Promise<IMovie>
  type HandleSearch = () => Promise<IMovie[]>
  type HandleParseIframe = () => Promise<string[] | string>

  abstract class Handle {
    getConfig: HandleConfig
    getCategory?: HandleCategory
    getHome?: HandleHome
    getDetail?: HandleDetail
    getSearch?: HandleSearch
    parseIframe?: HandleParseIframe
  }

}

export { }