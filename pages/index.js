import Head from 'next/head';
import { useState, useEffect } from "react";

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);

  function loginGoogle() {
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GAPPID}&redirect_uri=${process.env.GREDIRECT}&state=G-Ayylmao&access_type=offline&response_type=code&prompt=consent&scope=https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email`;
  }
  
  function loginFacebook() {
    window.location.href = `https://www.facebook.com/v11.0/dialog/oauth?client_id=${process.env.FBAPPID}&redirect_uri=${[process.env.FBREDIRECT]}&state=F-Ayylmao&response_type=code&scope=email`;
  }
  
  function logout() {
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("refresh_token");
    setLoggedIn(false);
  }

  useEffect(() => {
    if(window.localStorage.getItem("access_token")){
      setLoggedIn(true);
    }
  },[]);

  return (
    <div className="container">
      <Head>
        <title>OAyylmaoth2</title>
      </Head>

      <main>
        <h1>OAuth Practice</h1>
        {
        !loggedIn ? 
          <>
            <button className="facebook" onClick={loginFacebook}>FACEBOOK</button>
            <button className="google " onClick={loginGoogle}>GOOGLE</button>
          </>
        :
          <>
            <p>You're logged in</p>
            <button className="google" onClick={logout}>LOGOUT</button>
          </>
        }
      </main>
    </div>
  );
}