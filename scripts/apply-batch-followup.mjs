import fs from 'node:fs'

function replaceOne(path,from,to){
  const source=fs.readFileSync(path,'utf8')
  if(!source.includes(from))throw new Error(`Anchor not found in ${path}`)
  fs.writeFileSync(path,source.replace(from,to))
}

replaceOne(
  'src/App.tsx',
  `{classification?.reviewStatus==='NEEDS_REVIEW'&&<small className="ai-summary">⚠ Ellenőrzendő AI-besorolás{classification.confidence!=null?' · '+Math.round(Number(classification.confidence)*100)+'% bizonyosság':''}</small>}{classification?.reviewStatus==='AUTO_CLASSIFIED'&&<small className="ai-summary">AI rendezve{classification.confidence!=null?' · '+Math.round(Number(classification.confidence)*100)+'% bizonyosság':''}</small>}`,
  `{classification?.reviewStatus==='NEEDS_REVIEW'&&<small className="ai-summary">⚠ Ellenőrzendő besorolás{classification.confidence!=null?' · '+Math.round(Number(classification.confidence)*100)+'% bizonyosság':''}</small>}{classification?.reviewStatus==='AUTO_CLASSIFIED'&&<small className="ai-summary">{classification.source==='USER'?'Kézi besorolás':'AI rendezve'}{classification.confidence!=null?' · '+Math.round(Number(classification.confidence)*100)+'% bizonyosság':''}</small>}`
)

replaceOne(
  'src/BatchDocumentUpload.tsx',
  `      const response=await fetch('/api/ai',{method:'POST',headers:{\n        'Content-Type':'application/json',Authorization:'Bearer '+session.access_token\n      },body:JSON.stringify({mode:'document',companyId:company.company_id,document:{\n        id:document.id,url:signed.data.signedUrl,mimeType:file.type||document.mime_type,fileName:file.name\n      }})})`,
  `      const aiMime=file.type||document.mime_type||(file.name.toLowerCase().endsWith('.pdf')?'application/pdf':'application/octet-stream')\n      const response=await fetch('/api/ai',{method:'POST',headers:{\n        'Content-Type':'application/json',Authorization:'Bearer '+session.access_token\n      },body:JSON.stringify({mode:'document',companyId:company.company_id,document:{\n        id:document.id,url:signed.data.signedUrl,mimeType:aiMime,fileName:file.name\n      }})})`
)
