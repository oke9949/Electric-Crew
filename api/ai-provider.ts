export type AiInput = Array<Record<string,unknown>>

export type AiProviderConfig = {
  openAiKey?:string
  openAiModel?:string
  gatewayToken?:string
  gatewayModel?:string
}

export type AiSource = {
  title:string
  url:string
}

export type AiRequestOptions = {
  webSearch?:boolean
}

export type AiProviderResult = {
  text:string
  provider:'openai'|'vercel-gateway'
  model:string
  sources:AiSource[]
}

type FetchLike = (input:string|URL|Request,init?:RequestInit)=>Promise<Response>
type RequestAiThirdArg = AiRequestOptions|FetchLike

type Provider = {
  name:AiProviderResult['provider']
  endpoint:string
  token:string
  model:string
}

export class AiProviderError extends Error{
  statusCode:number
  code:'AI_NOT_CONFIGURED'|'AI_PROVIDER_UNAVAILABLE'

  constructor(code:AiProviderError['code'],message:string,statusCode=503){
    super(message)
    this.name='AiProviderError'
    this.code=code
    this.statusCode=statusCode
  }
}

export async function requestAi(input:AiInput,config:AiProviderConfig,optionsOrFetch:RequestAiThirdArg={},fetchOverride?:FetchLike):Promise<AiProviderResult>{
  const options:AiRequestOptions=typeof optionsOrFetch==='function'?{}:optionsOrFetch
  const fetchImpl:FetchLike=typeof optionsOrFetch==='function'?optionsOrFetch:(fetchOverride||fetch)
  const providers:Provider[]=[]
  if(config.openAiKey)providers.push({name:'openai',endpoint:'https://api.openai.com/v1/responses',token:config.openAiKey,model:config.openAiModel||'gpt-5.4-mini'})
  if(config.gatewayToken)providers.push({name:'vercel-gateway',endpoint:'https://ai-gateway.vercel.sh/v1/responses',token:config.gatewayToken,model:config.gatewayModel||'openai/gpt-5.4-mini'})
  if(!providers.length)throw new AiProviderError('AI_NOT_CONFIGURED','Az AI-szolgáltatás még nincs konfigurálva. Kérd az adminisztrátort egy szerveroldali provider-kulcs beállítására.')

  const failures:number[]=[]
  for(const provider of providers){
    try{
      const body:any={model:provider.model,input,max_output_tokens:1800,reasoning:{effort:'low'},store:false}
      if(options.webSearch){
        body.tools=[{type:'web_search'}]
        body.tool_choice='auto'
        body.include=['web_search_call.action.sources']
      }
      const response=await fetchImpl(provider.endpoint,{method:'POST',headers:{Authorization:'Bearer '+provider.token,'Content-Type':'application/json'},body:JSON.stringify(body)})
      if(!response.ok){failures.push(response.status);continue}
      const result=await response.json() as any
      const text=extractOutputText(result)
      if(!text){failures.push(502);continue}
      return {text,provider:provider.name,model:provider.model,sources:extractSources(result)}
    }catch{
      failures.push(503)
    }
  }

  const configurationFailure=failures.some(status=>status===401||status===402||status===403)
  throw new AiProviderError('AI_PROVIDER_UNAVAILABLE',configurationFailure
    ?'Az AI-szolgáltató hitelesítése vagy számlázási beállítása nem érvényes. Kérd az adminisztrátort a szerveroldali provider-konfiguráció ellenőrzésére.'
    :'Az AI-szolgáltatás átmenetileg nem érhető el. Próbáld újra később.')
}

function extractOutputText(result:any){
  if(typeof result?.output_text==='string'&&result.output_text.trim())return result.output_text.trim()
  const text=(result?.output||[]).flatMap((item:any)=>item?.content||[]).find((item:any)=>item?.type==='output_text')?.text
  return typeof text==='string'&&text.trim()?text.trim():''
}

function extractSources(result:any):AiSource[]{
  const sources:AiSource[]=[]
  const seen=new Set<string>()
  const add=(value:any)=>{
    const url=String(value?.url||value?.link||value?.url_citation?.url||'').trim()
    if(!/^https:\/\//i.test(url)||seen.has(url))return
    const title=String(value?.title||value?.name||value?.url_citation?.title||url).trim()||url
    seen.add(url);sources.push({title,url})
  }
  for(const item of result?.output||[]){
    if(item?.type==='web_search_call')for(const source of item?.action?.sources||item?.sources||[])add(source)
    for(const content of item?.content||[])for(const annotation of content?.annotations||[])add(annotation)
  }
  for(const source of result?.sources||[])add(source)
  return sources.slice(0,8)
}
