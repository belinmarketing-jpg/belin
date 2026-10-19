const SUPABASE_URL='https://wtzihjezhjevezgdipob.supabase.co';
const SUPABASE_KEY='sb_publishable_tsmAOm5VA3ZubP85FNX1xA_Hz7KPRl6';
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
window.belinAuth=supabaseClient;
