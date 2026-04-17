const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.from('dte_caf').select('caf_xml').eq('restaurant_id', '2c8864cd-84a8-4517-b4c1-920b5f6c25f1').limit(1).single();
  const xml = data.caf_xml;
  const rsaskMatch = /<RSASK>([\s\S]*?)<\/RSASK>/.exec(xml);
  console.log("RSASK keys:", rsaskMatch[1]);
}
run();
