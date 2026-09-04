import assert from 'node:assert/strict'
import test from 'node:test'
import { AiProviderError, requestAi } from './ai-provider.ts'

const input=[{type:'message',role:'user',content:'Mi a mai teendő?'}]

test('a közvetlen OpenAI útvonal az elsődleges és sikeresen visszaadja a chat választ',async()=>{
  const calls:Array<{url:string;init?:RequestInit}>=[]
  const result=await requestAi(input,{openAiKey:'server-secret',gatewayToken:'gateway-secret'},async(url,init)=>{
    calls.push({url:String(url),init})
    return new Response(JSON.stringify({output_text:'A közvetlen provider működik.'}),{status:200,headers:{'Content-Type':'application/json'}})
  })
  assert.equal(result.text,'A közvetlen provider működik.')
  assert.equal(result.provider,'openai')
  assert.equal(result.model,'gpt-5.4-mini')
  assert.deepEqual(result.sources,[])
  assert.equal(calls.length,1)
  assert.equal(calls[0].url,'https://api.openai.com/v1/responses')
  assert.equal(new Headers(calls[0].init?.headers).get('authorization'),'Bearer server-secret')
  const body=JSON.parse(String(calls[0].init?.body))
  assert.equal(body.model,'gpt-5.4-mini')
  assert.equal(body.store,false)
})

test('webes módban bekapcsolja a Responses web_search toolt és visszaadja a forrásokat',async()=>{
  let sentBody:any
  const result=await requestAi(input,{openAiKey:'server-secret'},{webSearch:true},async(_url,init)=>{
    sentBody=JSON.parse(String(init?.body))
    return Response.json({
      output_text:'Gyártói adatlap alapján ez az érték.',
      output:[{type:'web_search_call',action:{sources:[{title:'Gyártói adatlap',url:'https://manufacturer.example/manual'},{title:'Duplikátum',url:'https://manufacturer.example/manual'}]}}]
    })
  })
  assert.deepEqual(sentBody.tools,[{type:'web_search'}])
  assert.equal(sentBody.tool_choice,'auto')
  assert.deepEqual(sentBody.include,['web_search_call.action.sources'])
  assert.deepEqual(result.sources,[{title:'Gyártói adatlap',url:'https://manufacturer.example/manual'}])
})

test('közvetlen provider hiba esetén az opcionális Gateway fallback következik',async()=>{
  const urls:string[]=[]
  const result=await requestAi(input,{openAiKey:'bad-key',gatewayToken:'gateway-secret'},async url=>{
    urls.push(String(url))
    if(urls.length===1)return new Response(JSON.stringify({error:{message:'payment link'}}),{status:402,headers:{'Content-Type':'application/json'}})
    return new Response(JSON.stringify({output:[{content:[{type:'output_text',text:'Fallback válasz.'}]}]}),{status:200,headers:{'Content-Type':'application/json'}})
  })
  assert.deepEqual(urls,['https://api.openai.com/v1/responses','https://ai-gateway.vercel.sh/v1/responses'])
  assert.equal(result.provider,'vercel-gateway')
  assert.equal(result.text,'Fallback válasz.')
})

test('provider nélkül rövid magyar konfigurációs hibát ad',async()=>{
  await assert.rejects(requestAi(input,{}),(error:unknown)=>{
    assert.ok(error instanceof AiProviderError)
    assert.equal(error.code,'AI_NOT_CONFIGURED')
    assert.equal(error.statusCode,503)
    assert.match(error.message,/nincs konfigurálva/i)
    assert.doesNotMatch(error.message,/https?:\/\//i)
    return true
  })
})

test('a kép és PDF dokumentum-input változatlanul eljut a direct providerhez',async()=>{
  const documentInput=[{type:'message',role:'user',content:[{type:'input_text',text:'Elemezd.'},{type:'input_image',image_url:'https://files.example/image.jpg'},{type:'input_file',file_url:'https://files.example/invoice.pdf'}]}]
  let sentBody:any
  await requestAi(documentInput,{openAiKey:'server-secret'},async(_url,init)=>{
    sentBody=JSON.parse(String(init?.body))
    return Response.json({output_text:'{"documentType":"szamla"}'})
  })
  assert.deepEqual(sentBody.input,documentInput)
})

test('provider 402 hiba nem szivárogtat nyers billing URL-t',async()=>{
  await assert.rejects(requestAi(input,{gatewayToken:'gateway-secret'},async()=>new Response(JSON.stringify({error:{message:'AI Gateway requires a valid credit card https://vercel.com/billing'}}),{status:402,headers:{'Content-Type':'application/json'}})),(error:unknown)=>{
    assert.ok(error instanceof AiProviderError)
    assert.equal(error.code,'AI_PROVIDER_UNAVAILABLE')
    assert.match(error.message,/számlázási beállítása/i)
    assert.doesNotMatch(error.message,/https?:\/\//i)
    assert.doesNotMatch(error.message,/credit card/i)
    return true
  })
})
