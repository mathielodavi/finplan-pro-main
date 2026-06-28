import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    console.log("Testing financeiro_parcelas...");
    const { data: p, error: pe } = await supabase.from('financeiro_parcelas').select('id').limit(1);
    console.log("financeiro_parcelas error:", pe ? pe.message : "OK");

    console.log("Testing reunioes...");
    const { data: r, error: re } = await supabase.from('reunioes').select('id').limit(1);
    console.log("reunioes error:", re ? re.message : "OK");

    console.log("Testing contratos...");
    const { data: c, error: ce } = await supabase.from('contratos').select('tipo').limit(5);
    console.log("contratos error:", ce ? ce.message : "OK", c);
}
run();
