import { useEffect } from "react";
import { useRouter } from "next/router";
import CustomInput from "../../components/customInput";
import getParameterByName from "../../utils/getParameterByName";

// Create input and set up its validator
// validity param is the validity name and its message
// customValidator is a function that does validation
function initInput(form, inputName, validity, customValidator){
    // Function to hide/display error message div
    function triggerError(){
        // Next sibling is the error div
        let errorElement = form[inputName].nextElementSibling;
        let error = false

        // Go through each validity type
        for(let key in validity){
            // If customValidator is set
            if(customValidator && customValidator()){
                errorElement.textContent = validity["custom"];
                error = true;
                break;
            } else if(form[inputName].validity[key]) {
                errorElement.textContent = validity[key];
                error = true;
                break;
            } else {
                errorElement.textContent = "";
            }
        }

        if(error) errorElement.classList.add("active");
        else errorElement.classList.remove("active");
    }
    
    form[inputName].value = getParameterByName(inputName) ?? "";
    form[inputName].addEventListener("input", triggerError);
    triggerError();
}

export default function FinalSteps() {
    const router = useRouter();

    async function submitForm(e){
        e.preventDefault();
        const form = e.target.form;
    
        let response = await fetch("/api/auth/facebook", {
            method: "POST",
            contetType: "application/json",
            body: await JSON.stringify({
                "id": form["id"].value,
                "first_name": form["first_name"].value,
                "middle_name": form["middle_name"].value,
                "last_name": form["last_name"].value,
                "email": form["email"].value,
                "phone": form["phone"].value,
                "country": form["country"].value,
                "province": form["province"].value,
                "city": form["city"].value,
                "district": form["district"].value,
                "password": form["password"].value,
            })
        });
        
        if(response.status == 200){
            const json = await response.json();
            // If token is returned, store it in localStorage
            if(json["status"] == "success" && json["data"]["access_token"] != null && json["data"]["access_token"].length > 2){
                window.localStorage.setItem("access_token", json["data"]["access_token"]);
                window.localStorage.setItem("refresh_token", json["data"]["refresh_token"]);
                router.push("/");
            } else if (json["status"] == "error") {
                // If errors are returned, update the form to show errors
                let form = document.querySelector("#signupForm");
                for(let key in json["data"]){
                    if(form[key] != null){
                        let errorElement = form[key].nextElementSibling;
                        errorElement.textContent = json["data"][key];
                        errorElement.classList.add("active");
                    }
                }
            }
        }
    }

    useEffect(() => {
        const form = document.querySelector("#signupForm");

        initInput(form, "first_name", {
            tooLong: "First name must be shorter than 50 characters",
            tooShort: "First name must be longer than 3 characters"
        });

        initInput(form, "middle_name", {
            tooLong: "Middle name must be shorter than 50 characters",
        });

        initInput(form, "last_name", {
            tooLong: "Last name must be shorter than 50 characters",
            tooShort: "Last name must be longer than 3 characters"
        });

        initInput(form, "email", {
            valueMissing: "This field is required",
            typeMismatch: "Invalid email format, must be <email>@<domain>.<tld>",
        });

        initInput(form, "phone", {
            valueMissing: "This field is required",
            patternMismatch: "Invalid phone number",
        });

        initInput(form, "password", {
            valueMissing: "This field is required",
            patternMismatch: "Invalid password, must be at least 8 characters long",
        });

        initInput(form, "confirm_password", {
            valueMissing: "This field is required",
            custom: "Invalid password, must be at least 8 characters long",
        }, () => form["password"].value != form["confirm_password"].value);

        form["id"].value = getParameterByName("id") ?? "";
        form["country"].value = getParameterByName("country") ?? "";
        form["province"].value = getParameterByName("province") ?? "";
        form["city"].value = getParameterByName("city") ?? "";
        form["district"].value = getParameterByName("district") ?? "";
    }, []);

    return(
        <>
            <div className="leftBox">
                <div className="form-container">
                    <form id="signupForm" noValidate>
                        <h2>FINAL STEP</h2>
                        <div className="col input-container">
                            <CustomInput name="id" type="hidden" required />
                            <CustomInput name="first_name" type="text" placeholder="First Name" minLength="3" maxLength="50" required={true} />
                            <CustomInput name="middle_name" type="text" placeholder="Middle Name" maxLength="50" />
                            <CustomInput name="last_name" type="text" placeholder="Last Name" minLength="3" maxLength="50" required={true} />
                            <CustomInput name="email" type="email" placeholder="Email" required={true} />
                            <CustomInput name="phone" type="tel" placeholder="Phone Number" pattern="((0{0,2}|\+)\d{0,3})?(0([1-9]{1,2})|1[\d]|3[\d]|2[0-1])[\d]{3}[\d]{4,5}" required={true} />
                            <CustomInput name="country" type="text" placeholder="Country" required={true} />
                            <CustomInput name="province" type="text" placeholder="Province" required={true} />
                            <CustomInput name="city" type="text" placeholder="City" required={true} />
                            <CustomInput name="district" type="text" placeholder="District" />
                            <CustomInput name="password" type="text" placeholder="Password" pattern="^(\w{8,32})\S$" required={true} />
                            <CustomInput name="confirm_password" type="password" placeholder="Confirm Password" pattern="^(\w{8,32})\S$" required={true} />
                        </div>
                        <div className="col">
                            <p className="small-text">By clicking submit you agree to blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah blah...</p>
                            <button className="button block" style={{height:"45px"}} onClick={submitForm}>Submit</button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}