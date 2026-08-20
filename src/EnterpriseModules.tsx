import { useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import {
  AlertTriangle, BarChart3, Bot, BriefcaseBusiness, CircleDollarSign, FileText,
  HandHelping, PackageSearch, Plus, RefreshCw, ShoppingCart, Siren, Sparkles,
  Timer, TrendingUp, Wrench
} from "lucide-react"
import { supabase } from "./supabase"

type CompanyRef = { company_id: string; company_name: string; role: string; status: string }
type OperationTab = "problems" | "help_requests" | "tool_requests" | "procurements"
type FinanceTab = "clients" | "quotes" | "invoices" | "documents"
type FieldDef = [string, string, "text" | "email" | "number" | "date" | "textarea" | "select", Array<[string, string]>?]

const operationConfig: Record<OperationTab, {
  label: string
  table: string
  icon: typeof Siren
  empty: Record<string, string | number>
  fields: FieldDef[]
}> = {
  problems: {
    label: "Problémák",
    table: "problems",
    icon: Siren,
    empty: { title: "", description: "", priority: "NORMAL", status: "OPEN" },
    fields: [
      ["title", "Megnevezés", "text"],
      ["description", "Leírás", "textarea"],
      ["priority", "Prioritás", "select", [["LOW", "Alacsony"], ["NORMAL", "Normál"], ["HIGH", "Magas"], ["URGENT", "Sürgős"]]],
      ["status", "Állapot", "select", [["OPEN", "Nyitott"], ["IN_PROGRESS", "Folyamatban"], ["RESOLVED", "Megoldva"]]]
    ]
  },
  help_requests: {
    label: "Segítségkérések",
    table: "help_requests",
    icon: HandHelping,
    empty: { title: "", description: "", urgency: "NORMAL", status: "OPEN" },
    fields: [
      ["title", "Segítség tárgya", "text"],
      ["description", "Leírás", "textarea"],
      ["urgency", "Sürgősség", "select", [["NORMAL", "Normál"], ["HIGH", "Magas"], ["URGENT", "Azonnali"]]],
      ["status", "Állapot", "select", [["OPEN", "Nyitott"], ["ACCEPTED", "Elfogadva"], ["DONE", "Kész"]]]
    ]
  },
  tool_requests: {
    label: "Szerszámigények",
    table: "tool_requests",
    icon: Wrench,
    empty: { title: "", description: "", quantity: 1, status: "REQUESTED" },
    fields: [
      ["title", "Szerszám", "text"],
      ["quantity", "Mennyiség", "number"],
      ["description", "Megjegyzés", "textarea"],
      ["status", "Állapot", "select", [["REQUESTED", "Igényelve"], ["ORDERED", "Megrendelve"], ["RECEIVED", "Beérkezett"]]]
    ]
  },
  procurements: {
    label: "Beszerzés",
    table: "procurements",
    icon: ShoppingCart,
    empty: { title: "", quantity: 1, unit: "db", supplier: "", estimated_cost: 0, status: "PROPOSAL" },
    fields: [
      ["title", "Beszerzés tárgya", "text"],
      ["quantity", "Mennyiség", "number"],
      ["unit", "Mértékegység", "text"],
      ["supplier", "Beszállító", "text"],
      ["estimated_cost", "Becsült nettó érték", "number"],
      ["status", "Állapot", "select", [["PROPOSAL", "Javaslat"], ["APPROVED", "Jóváhagyva"], ["ORDERED", "Megrendelve"], ["RECEIVED", "Beérkezett"]]]
    ]
  }
}

export function Operations({ company, user }: { company: CompanyRef; user: User }) {
  const [tab, setTab] = useState<OperationTab>("problems")
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [editing, setEditing] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const config = operationConfig[tab]

  async function load() {
    setBusy(true)
    setError("")
    const { data, error: queryError } = await supabase
      .from(config.table)
      .select("*")
      .eq("company_id", company.company_id)
      .order("created_at", { ascending: false })
      .limit(200)
    setRows(data || [])
    if (queryError) setError(queryError.message)
    setBusy(false)
  }

  useEffect(() => { void load() }, [company.company_id, tab])

  async function save(values: Record<string, any>) {
    const payload = {
      ...values,
      company_id: company.company_id,
      created_by: user.id,
      quantity: values.quantity === undefined ? undefined : Number(values.quantity),
      estimated_cost: values.estimated_cost === undefined ? undefined : Number(values.estimated_cost)
    }
    const { error: insertError } = await supabase.from(config.table).insert(payload)
    if (insertError) throw insertError
    setEditing(null)
    await load()
  }

  return <>
    <PageTitle
      title="Operatív központ"
      text="Problémák, segítségkérések, szerszámigények és beszerzések egy helyen."
      action={<button className="btn primary" onClick={() => setEditing({ ...config.empty })}><Plus size={17} />Új bejegyzés</button>}
    />
    <TabStrip
      items={(Object.keys(operationConfig) as OperationTab[]).map(key => [key, operationConfig[key].label])}
      value={tab}
      onChange={value => setTab(value as OperationTab)}
    />
    {error && <InlineNotice>{error}</InlineNotice>}
    {busy ? <Busy /> : <div className="cards-list">
      {rows.map(row => {
        const Icon = config.icon
        return <div className="list-row operation-row" key={row.id}>
          <div className="list-icon"><Icon /></div>
          <div className="grow">
            <b>{row.title}</b>
            <span>{row.description || row.supplier || formatQuantity(row) || "Nincs megjegyzés"} · {formatDate(row.created_at)}</span>
          </div>
          <Pill value={row.status || row.priority || "OPEN"} />
        </div>
      })}
      {!rows.length && <Empty text={"Nincs " + config.label.toLowerCase() + "."} />}
    </div>}
    {editing && <Dialog title={"Új – " + config.label} onClose={() => setEditing(null)}>
      <DynamicForm initial={editing} fields={config.fields} onSave={save} />
    </Dialog>}
  </>
}

export function Finance({ company, user }: { company: CompanyRef; user: User }) {
  const [tab, setTab] = useState<FinanceTab>("clients")
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [editing, setEditing] = useState<Record<string, any> | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")
  const labels: Record<FinanceTab, string> = { clients: "Ügyfelek", quotes: "Ajánlatok", invoices: "Számlák", documents: "AI pénzügyi összesítő" }

  async function load() {
    setBusy(true)
    setError("")
    const table=tab==="documents"?"financial_entries":tab
    const selection=tab==="documents"?"*,documents!financial_entries_source_document_id_fkey(file_name)":"*"
    const { data, error: queryError } = await supabase
      .from(table)
      .select(selection)
      .eq("company_id", company.company_id)
      .order("created_at", { ascending: false })
      .limit(250)
    setRows(data || [])
    if (queryError) setError(queryError.message)
    setBusy(false)
  }

  useEffect(() => { void load() }, [company.company_id, tab])

  const fields: FieldDef[] = tab === "clients" ? [
    ["name", "Ügyfél neve", "text"],
    ["contact_name", "Kapcsolattartó", "text"],
    ["email", "E-mail", "email"],
    ["phone", "Telefon", "text"],
    ["address", "Cím", "textarea"]
  ] : tab === "quotes" ? [
    ["number", "Ajánlatszám", "text"],
    ["client_name", "Ügyfél", "text"],
    ["title", "Megnevezés", "text"],
    ["net_total", "Nettó összeg", "number"],
    ["status", "Állapot", "select", [["DRAFT", "Piszkozat"], ["SENT", "Elküldve"], ["ACCEPTED", "Elfogadva"], ["REJECTED", "Elutasítva"]]],
    ["valid_until", "Érvényes", "date"]
  ] : [
    ["number", "Számlaszám", "text"],
    ["client_name", "Ügyfél", "text"],
    ["title", "Megnevezés", "text"],
    ["net_total", "Nettó összeg", "number"],
    ["status", "Állapot", "select", [["DRAFT", "Piszkozat"], ["ISSUED", "Kiállítva"], ["PAID", "Fizetve"], ["OVERDUE", "Lejárt"]]],
    ["due_date", "Fizetési határidő", "date"]
  ]

  function empty() {
    return tab === "clients"
      ? { name: "", contact_name: "", email: "", phone: "", address: "" }
      : { number: "", client_name: "", title: "", net_total: 0, status: "DRAFT", valid_until: "", due_date: "" }
  }

  async function save(values: Record<string, any>) {
    const payload: Record<string, any> = {
      ...values,
      company_id: company.company_id,
      created_by: user.id
    }
    if (tab !== "clients") payload.net_total = Number(values.net_total || 0)
    if (tab === "quotes") {
      payload.valid_until = values.valid_until || null
      delete payload.due_date
    } else if (tab === "invoices") {
      payload.due_date = values.due_date || null
      delete payload.valid_until
    } else {
      delete payload.net_total
      delete payload.valid_until
      delete payload.due_date
    }
    const { error: insertError } = await supabase.from(tab).insert(payload)
    if (insertError) throw insertError
    setEditing(null)
    await load()
  }

  const total = useMemo(() => rows.reduce((sum, row) => sum + Number(tab==="documents"?row.gross_amount:row.net_total || 0), 0), [rows,tab])
  const documentIncome=useMemo(()=>rows.filter(row=>row.entry_type==='INCOME').reduce((sum,row)=>sum+Number(row.gross_amount||0),0),[rows])
  const documentExpense=useMemo(()=>rows.filter(row=>row.entry_type==='EXPENSE').reduce((sum,row)=>sum+Number(row.gross_amount||0),0),[rows])
  const documentVat=useMemo(()=>rows.reduce((sum,row)=>sum+Number(row.vat_amount||0),0),[rows])

  return <>
    <PageTitle
      title="Pénzügy és ügyfelek"
      text="Ügyféltörzs, ajánlatok és számlakövetés."
      action={tab!=="documents"?<button className="btn primary" onClick={() => setEditing(empty())}><Plus size={17} />Új</button>:undefined}
    />
    <TabStrip items={(Object.keys(labels) as FinanceTab[]).map(key => [key, labels[key]])} value={tab} onChange={value => setTab(value as FinanceTab)} />
    {tab !== "clients" && tab!=="documents" && <div className="summary-line">
      <Metric icon={CircleDollarSign} label="Összes nettó érték" value={money(total)} />
      <Metric icon={FileText} label="Tételek" value={rows.length} />
    </div>}
    {tab==="documents"&&<div className="kpi-grid"><Metric icon={TrendingUp} label="Bevétel" value={money(documentIncome)}/><Metric icon={ShoppingCart} label="Kiadás" value={money(documentExpense)} danger/><Metric icon={CircleDollarSign} label="Egyenleg" value={money(documentIncome-documentExpense)}/><Metric icon={FileText} label="ÁFA" value={money(documentVat)}/></div>}
    {error && <InlineNotice>{error}</InlineNotice>}
    {busy ? <Busy /> : <div className="table-card">
      <div className="mobile-cards">
        {rows.map(row => <div className="mobile-entity" key={row.id}>
          <div className="row"><div><b>{row.name || row.number || row.reference_number || row.title}</b><span>{row.client_name || row.counterparty || row.contact_name || row.email || "—"}</span></div>{row.status && <Pill value={row.status} />}</div>
        </div>)}
      </div>
      <table>
        <thead><tr><th>{tab === "clients" ? "Ügyfél" : "Azonosító"}</th><th>Kapcsolat / megnevezés</th>{tab !== "clients" && <th>{tab==='documents'?'Bruttó érték':'Nettó érték'}</th>}<th>Állapot</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <td><b>{row.name || row.number || row.reference_number || "—"}</b></td>
          <td>{row.client_name || row.counterparty || row.contact_name || row.title || "—"}<span>{row.documents?.file_name || row.email || row.phone || ""}</span></td>
          {tab !== "clients" && <td className="money">{money(tab==='documents'?row.gross_amount:row.net_total)}</td>}
          <td>{row.status ? <Pill value={row.status} /> : <Pill value="ACTIVE" />}</td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <Empty text="Nincs rögzített adat." />}
    </div>}
    {editing && <Dialog title={"Új – " + labels[tab]} onClose={() => setEditing(null)}>
      <DynamicForm initial={editing} fields={fields} onSave={save} />
    </Dialog>}
  </>
}

export function Reports({ company }: { company: CompanyRef }) {
  const [data, setData] = useState<Record<string, any[]> | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState("")

  async function load() {
    setBusy(true)
    setError("")
    const id = company.company_id
    const results = await Promise.all([
      supabase.from("projects").select("id,active,progress").eq("company_id", id),
      supabase.from("tasks").select("id,status,priority,progress").eq("company_id", id),
      supabase.from("work_logs").select("hours,work_date").eq("company_id", id),
      supabase.from("invoices").select("net_total,status").eq("company_id", id),
      supabase.from("procurements").select("estimated_cost,status").eq("company_id", id)
    ])
    const failed = results.find(result => result.error)
    if (failed?.error) setError(failed.error.message)
    const [projects, tasks, logs, invoices, procurements] = results.map(result => result.data || [])
    setData({ projects, tasks, logs, invoices, procurements })
    setBusy(false)
  }

  useEffect(() => { void load() }, [company.company_id])
  if (busy) return <Busy />

  const current = data || { projects: [], tasks: [], logs: [], invoices: [], procurements: [] }
  const projectAverage = average(current.projects.map(item => Number(item.progress || 0)))
  const taskAverage = average(current.tasks.map(item => Number(item.progress || 0)))
  const hours = current.logs.reduce((sum, item) => sum + Number(item.hours || 0), 0)
  const revenue = current.invoices.filter(item => item.status === "PAID").reduce((sum, item) => sum + Number(item.net_total || 0), 0)
  const pipeline = current.invoices.filter(item => item.status !== "PAID").reduce((sum, item) => sum + Number(item.net_total || 0), 0)
  const blocked = current.tasks.filter(item => item.status === "BLOCKED").length
  const completed = current.tasks.length ? Math.round(current.tasks.filter(item => item.status === "DONE").length / current.tasks.length * 100) : 0

  return <>
    <PageTitle title="Vezetői riportok" text="Működési, projekt- és pénzügyi mutatók valós időben." action={<button className="btn" onClick={() => void load()}><RefreshCw size={17} />Frissítés</button>} />
    {error && <InlineNotice>{error}</InlineNotice>}
    <div className="kpi-grid">
      <Metric icon={TrendingUp} label="Projektátlag" value={projectAverage + "%"} />
      <Metric icon={Timer} label="Rögzített munkaóra" value={hours} />
      <Metric icon={CircleDollarSign} label="Fizetett nettó" value={money(revenue)} />
      <Metric icon={FileText} label="Kintlévőség" value={money(pipeline)} />
      <Metric icon={Siren} label="Blokkolt feladat" value={blocked} danger />
      <Metric icon={BriefcaseBusiness} label="Projektek" value={current.projects.length} />
    </div>
    <div className="report-grid">
      <ReportBar label="Projektkészültség" value={projectAverage} />
      <ReportBar label="Feladatkészültség" value={taskAverage} />
      <ReportBar label="Lezárt feladatok" value={completed} />
    </div>
  </>
}

export function Assistant({ company }: { company: CompanyRef }) {
  const [insights, setInsights] = useState<Array<{ level: string; title: string; text: string }>>([])
  const [busy, setBusy] = useState(true)

  async function analyze() {
    setBusy(true)
    const id = company.company_id
    const [tasks, materials, projects, invoices, procurements] = await Promise.all([
      supabase.from("tasks").select("*").eq("company_id", id),
      supabase.from("materials").select("*").eq("company_id", id),
      supabase.from("projects").select("*").eq("company_id", id).eq("active", true),
      supabase.from("invoices").select("*").eq("company_id", id),
      supabase.from("procurements").select("*").eq("company_id", id)
    ])
    const list: Array<{ level: string; title: string; text: string }> = []
    const blocked = (tasks.data || []).filter(item => item.status === "BLOCKED")
    if (blocked.length) list.push({ level: "danger", title: blocked.length + " blokkolt feladat", text: "Vezetői beavatkozás szükséges az elakadások feloldásához." })
    const low = (materials.data || []).filter(item => Number(item.stock_quantity) <= Number(item.min_stock_quantity))
    if (low.length) list.push({ level: "warning", title: low.length + " alacsony készletű anyag", text: "Indíts beszerzést a munkafolytonosság megőrzéséhez." })
    const late = (projects.data || []).filter(item => item.due_date && new Date(item.due_date) < new Date() && Number(item.progress) < 100)
    if (late.length) list.push({ level: "danger", title: late.length + " határidőn túli projekt", text: "Vizsgáld felül a kapacitást és a prioritásokat." })
    const overdue = (invoices.data || []).filter(item => item.status === "OVERDUE")
    if (overdue.length) list.push({ level: "warning", title: overdue.length + " lejárt számla", text: "Indíts fizetési emlékeztetőt és egyeztetést." })
    const waiting = (procurements.data || []).filter(item => item.status === "PROPOSAL")
    if (waiting.length) list.push({ level: "info", title: waiting.length + " jóváhagyásra váró beszerzés", text: "Ellenőrizd a beszerzési javaslatokat." })
    if (!list.length) list.push({ level: "ok", title: "A működés stabil", text: "Nem találtam azonnali beavatkozást igénylő eltérést." })
    setInsights(list)
    setBusy(false)
  }

  useEffect(() => { void analyze() }, [company.company_id])

  return <>
    <PageTitle title="Döntéstámogató" text="Adatalapú figyelmeztetések és vezetői következő lépések." action={<button className="btn primary" onClick={() => void analyze()}><Sparkles size={17} />Új elemzés</button>} />
    <div className="notice ok"><Bot size={17} /><span>Az elemzés kizárólag a cég Supabase-adataiból készül; külső AI-szolgáltatásnak nem továbbít adatot.</span></div>
    {busy ? <Busy /> : <div className="insight-grid">
      {insights.map((item, index) => <article className={"insight-card " + item.level} key={index}>
        <div className="list-icon"><Bot /></div>
        <div><span className="eyebrow">EC 6.0 AJÁNLÁS</span><h3>{item.title}</h3><p>{item.text}</p></div>
      </article>)}
    </div>}
  </>
}

function DynamicForm({ initial, fields, onSave }: { initial: Record<string, any>; fields: FieldDef[]; onSave: (values: Record<string, any>) => Promise<void> }) {
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return <form className="form-grid" onSubmit={async event => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try { await onSave(values) } catch (reason: any) { setError(reason?.message || "A mentés nem sikerült."); setBusy(false) }
  }}>
    {fields.map(([key, label, type, options]) => <label className={type === "textarea" ? "field full" : "field"} key={key}>
      <span>{label}</span>
      {type === "select"
        ? <select value={values[key] ?? ""} onChange={event => setValues({ ...values, [key]: event.target.value })}>{(options || []).map(option => <option value={option[0]} key={option[0]}>{option[1]}</option>)}</select>
        : type === "textarea"
          ? <textarea rows={4} value={values[key] ?? ""} onChange={event => setValues({ ...values, [key]: event.target.value })} />
          : <input type={type} value={values[key] ?? ""} required={["title", "name", "number"].includes(key)} onChange={event => setValues({ ...values, [key]: event.target.value })} />}
    </label>)}
    {error && <div className="full"><InlineNotice>{error}</InlineNotice></div>}
    <div className="modal-actions full"><button className="btn primary" disabled={busy}>{busy ? "Mentés…" : "Mentés"}</button></div>
  </form>
}

function PageTitle({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return <div className="page-hero"><div><h1>{title}</h1><p>{text}</p></div><div className="hero-actions">{action}</div></div>
}

function TabStrip({ items, value, onChange }: { items: Array<[string, string]>; value: string; onChange: (value: string) => void }) {
  return <div className="tabs">{items.map(item => <button className={value === item[0] ? "active" : ""} key={item[0]} onClick={() => onChange(item[0])}>{item[1]}</button>)}</div>
}

function Metric({ icon: Icon, label, value, danger }: { icon: typeof BarChart3; label: string; value: string | number; danger?: boolean }) {
  return <div className={"kpi " + (danger ? "danger-kpi" : "")}><div className="kpi-icon"><Icon size={19} /></div><div><span>{label}</span><strong>{value}</strong></div></div>
}

function ReportBar({ label, value }: { label: string; value: number }) {
  return <div className="report-bar"><div className="row"><b>{label}</b><strong>{value}%</strong></div><div className="progress"><i style={{ width: Math.max(0, Math.min(100, value)) + "%" }} /></div></div>
}

function Pill({ value }: { value: string }) {
  const labels: Record<string, string> = { OPEN: "Nyitott", IN_PROGRESS: "Folyamatban", RESOLVED: "Megoldva", DONE: "Kész", REQUESTED: "Igényelve", ORDERED: "Megrendelve", RECEIVED: "Beérkezett", PROPOSAL: "Javaslat", APPROVED: "Jóváhagyva", DRAFT: "Piszkozat", SENT: "Elküldve", ACCEPTED: "Elfogadva", REJECTED: "Elutasítva", ISSUED: "Kiállítva", PAID: "Fizetve", OVERDUE: "Lejárt", ACTIVE: "Aktív" }
  return <span className={"status s-" + String(value).toLowerCase()}>{labels[value] || value}</span>
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-wrap"><div className="scrim" onClick={onClose} /><div className="modal"><div className="modal-head"><h2>{title}</h2><button className="icon-btn" aria-label="Ablak bezárása" onClick={onClose}>×</button></div>{children}</div></div>
}

function InlineNotice({ children }: { children: React.ReactNode }) {
  return <div className="notice error"><AlertTriangle size={17} /><span>{children}</span></div>
}

function Busy() { return <div className="loading"><RefreshCw className="spin" /> Betöltés…</div> }
function Empty({ text }: { text: string }) { return <div className="empty"><PackageSearch size={30} /><span>{text}</span></div> }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat("hu-HU").format(new Date(value)) : "—" }
function formatQuantity(row: Record<string, any>) { return row.quantity ? String(row.quantity) + " " + String(row.unit || "") : "" }
function money(value: number) { return new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 }).format(Number(value || 0)) }
function average(values: number[]) { return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0 }

