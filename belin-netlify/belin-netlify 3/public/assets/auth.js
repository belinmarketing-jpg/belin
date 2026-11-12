(async()=>{
  const $=id=>document.getElementById(id);
  const message=(text,error=false)=>{$('message').textContent=text;$('message').className='message '+(error?'error':'ok')};
  const resetPage=location.pathname.replace(/\/$/,'')==='/login/reset';
  const recoveryAtLoad=new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
  const authError=new URLSearchParams(location.hash.slice(1)).get('error_description');
  try{
    const sb=await window.belinAuthReady;
    if(!sb)throw Error('Авторизация недоступна');
    let recovery=recoveryAtLoad;
    sb.auth.onAuthStateChange(event=>{
      if(event==='PASSWORD_RECOVERY'){
        recovery=true;
        if(!resetPage)location.replace('/login/reset/');
      }
    });
    if(!resetPage&&recoveryAtLoad){location.replace('/login/reset/');return}
    const {data:{session},error}=await sb.auth.getSession();if(error)throw error;
    if(resetPage){
      // A recovery session is stored by Supabase before this form is enabled.
      if(authError||!session){message('Ссылка недействительна или истекла. Запросите новое письмо на странице входа.',true);return}
      $('submitBtn').disabled=false;
      $('authForm').onsubmit=async event=>{
        event.preventDefault();const password=$('password').value;
        if(password.length<8||password!==$('confirmPassword').value){message('Пароли должны совпадать и содержать не менее 8 символов.',true);return}
        $('submitBtn').disabled=true;
        try{const {error}=await sb.auth.updateUser({password});if(error)throw error;
          await sb.auth.signOut({scope:'local'});$('authForm').hidden=true;message('Пароль обновлён. Теперь войдите с новым паролем.');
        }catch(error){message(error.message||'Не удалось обновить пароль',true);$('submitBtn').disabled=false}
      };
      return;
    }
    if(session&&!recovery){location.replace('/dashboard/');return}
    if(authError)message('Ссылка недействительна или истекла. Запросите новое письмо.',true);
    let mode='login';
    function setMode(next){mode=next;$('loginTab').classList.toggle('active',next==='login');$('registerTab').classList.toggle('active',next==='register');$('heading').textContent=next==='login'?'Войти в аккаунт':'Создать аккаунт';$('submitBtn').textContent=next==='login'?'Войти':'Зарегистрироваться';$('password').autocomplete=next==='login'?'current-password':'new-password';$('resetBtn').classList.toggle('hide',next==='register');message('')}
    $('loginTab').onclick=()=>setMode('login');$('registerTab').onclick=()=>setMode('register');
    $('submitBtn').disabled=false;
    $('authForm').onsubmit=async event=>{
      event.preventDefault();const email=$('email').value.trim(),password=$('password').value;$('submitBtn').disabled=true;message('Подождите…');
      try{
        if(mode==='register'){
          const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/dashboard/'}});if(error)throw error;
          message(data.session?'Аккаунт создан. Перенаправляем…':'Проверьте почту: мы отправили письмо для подтверждения.');if(data.session)location.href='/dashboard/';
        }else{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;location.href='/dashboard/'}
      }catch(error){message(error.message||'Ошибка авторизации',true)}finally{$('submitBtn').disabled=false}
    };
    $('resetBtn').onclick=async()=>{
      const email=$('email').value.trim();if(!email||!$('email').checkValidity()){message('Укажите корректный email.',true);return}
      $('resetBtn').disabled=true;
      try{const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/login/reset/'});if(error)throw error;message('Если адрес зарегистрирован, на почту придёт письмо для восстановления.')}
      catch(error){message(error.message||'Не удалось отправить письмо',true)}finally{$('resetBtn').disabled=false}
    };
  }catch(error){message(error.message||'Авторизация временно недоступна',true)}
})();
