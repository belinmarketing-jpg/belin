window.belinAuthReady=(async()=>{
  const response=await fetch('/api/config',{cache:'no-store'});
  if(!response.ok)throw Error('Авторизация временно недоступна');
  const config=await response.json();
  if(!config.url||!config.anonKey||!window.supabase)throw Error('Не удалось загрузить авторизацию');
  const client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.belinAuth=client;
  return client;
})();
// Consumers show the error in their own page rather than leaving an unhandled rejection.
window.belinAuthReady.catch(()=>{});
