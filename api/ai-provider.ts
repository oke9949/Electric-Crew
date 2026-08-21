export type AiInput = Array<Record<string,unknown>>

export type AiProviderConfig = {
  openAiKey?:string
  openAiModel?:string
  gatewayToken?:string
  gatewayModel?:string
}

export type AiProviderResult = {
  text:string
  provider:'openai'|'vercel-gateway'
  model:string
}

type FetchLike = (input:string|URL|Request,init?:RequestInit)=>Promise<Response>

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

export async function requestAi(input:AiInput,config:AiProviderConfig,fetchImpl:FetchLike=fetch):Promise<AiProviderResult>{
  const providers:Provider[]=[]
  if(config.openAiKey)providers.push({name:'openai',endpoint:'https://api.openai.com/v1/responses',token:config.openAiKey,model:config.openAiModel||'gpt-5.4-mini'})
  if(config.gatewayToken)providers.push({name:'vercel-gateway',endpoint:'https://ai-gateway.vercel.sh/v1/responses',token:config.gatewayToken,model:config.gatewayModel||'openai/gpt-5.4-mini'})
  if(!providers.length)throw new AiProviderError('AI_NOT_CONFIGURED','Az AI-szolgáltatás még nincs konfigurálva. Kérd az adminisztrátort egy szerveroldali provider-kulcs beállítására.')

  const failures:number[]=[]
  for(const provider of providers){
    try{
      const response=await fetchImpl(provider.endpoint,{method:'POST',headers:{Authorization:'Bearer '+provider.token,'Content-Type':'application/json'},body:JSON.stringify({model:provider.model,input,max_output_tokens:1800,reasoning:{effort:'low'},store:false})})
      if(!response.ok){failures.push(response.status);continue}
      const result=await response.json() as any
      const text=extractOutputText(result)
      if(!text){failures.push(502);continue}
      return {text,provider:provider.name,model:provider.model}
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
