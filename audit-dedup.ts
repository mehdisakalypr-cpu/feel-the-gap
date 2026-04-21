import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
async function main(){
  const { count: oppTotal } = await db.from('opportunities').select('*',{count:'exact',head:true})
  let page=0,total=0
  const pc=new Set<string>(), p=new Set<string>(), c=new Set<string>()
  while(true){
    const { data, error } = await db.from('opportunities').select('product_id,country_iso').range(page*1000,(page+1)*1000-1)
    if(error){console.error('err',error.message);break}
    if(!data?.length) break
    for(const r of data){ pc.add(`${r.product_id}|${r.country_iso}`); p.add(String(r.product_id)); c.add(String(r.country_iso)) }
    total+=data.length; page++
    if(page%20===0) console.log(`  scanned=${total} pc=${pc.size}`)
  }
  console.log('\n=== DEDUP AUDIT ===')
  console.log('Total opps in DB:', oppTotal)
  console.log('Opps scanned:', total)
  console.log('Distinct products:', p.size)
  console.log('Distinct countries:', c.size)
  console.log('Distinct (product × country) pairs:', pc.size)
  console.log('Avg opps per (product×country) pair:', (total/pc.size).toFixed(1))
  console.log('Dedup gain factor:', (total/pc.size).toFixed(1)+'×')
}
main().catch(e=>{console.error(e);process.exit(1)})
