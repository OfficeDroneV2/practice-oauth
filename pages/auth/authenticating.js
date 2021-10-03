import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import getParameterByName from "../../utils/getParameterByName";

// Fetch from /api/auth/[provider] with the code returned
// If login is successful, store tokens into localstorage and challenge into cookie
// Otherwise redirect to finalsteps to register user
async function completeLogin(router, setLoading, code, provider) {
    try {
        setLoading(true);
        const response = await fetch(provider.includes("G-") ? `/api/auth/google?code=${code}` : `/api/auth/facebook?code=${code}`);
        console.log("Response: ", response);

        if(response.status == 200 && response.redirected){
            router.replace(response.url);
        } else if (response.status == 200){
            let json = await response.json();
            console.log(json);
            if(json && json["status"] == "success") {
                window.localStorage.setItem("access_token", json["data"]["access_token"]);
                window.localStorage.setItem("refresh_token", json["data"]["refresh_token"]);
                router.replace("/");
            }
        } else {
            console.error("No response: ", response);
        }
    } catch (error) {
        console.log(error);
    } finally {
        setLoading(false);
    }
}

// Check if login tokens exist in localstorage and return to home if it does
function checkLoginState(router){
    const accessToken = window.localStorage.getItem("refresh_token");
    if(accessToken && accessToken.length > 0){
        router.replace("/");
    }
}

export default function OAuthLogin() {
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        checkLoginState(router);
        
        const code = getParameterByName("code", window.location.href);
        const provider = getParameterByName("state", window.location.href);
        if(code != null && code.length > 0){ completeLogin(router, setLoading, code, provider); }
    }, []);

    return (
        <div>
            <h2>{loading ? "Logging you in" : "Success! Redirecting.."}</h2>
        </div>
    );
}