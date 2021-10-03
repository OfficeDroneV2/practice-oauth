export default class validator {
    constructor(formData, debug = false){
        this.formData = JSON.parse(formData);
        this.errors = {};
        this.debug = debug;
    }

    emptyCheck(key, displayName) {
        let data = this.formData[key];
        if(this.debug) console.log(data, data != null && data.trim() != "");
        if(data && data.trim() != ""){
            return false;
        }
        this.errors[key] = `${displayName} is required`;
        return true;
    }

    minMaxCheck(key, min, max, displayName){
        let data = this.formData[key];
        if(data && data.length > max){
            this.errors[key] = `${displayName} must be shorter than ${max}`;
            return true;
        } else if(data.length < min){
            this.errors[key] = `${displayName} must be longer than ${min}`;
            return true;
        }
        return false;
    }

    patternCheck(key, pattern, displayName){
        let regex = new RegExp(pattern);
        let data = this.formData[key];
        if(data && !data.match(regex)){
            this.errors[key] = `Invalid ${displayName} format`;
            return true;
        }
        return false;
    }

    checkAll(key, displayName, {min, max, pattern}){
        if(this.debug) console.log(min, max, pattern);
        if(!this.emptyCheck(key, displayName)){
            if(min && max && !this.minMaxCheck(key, min, max, displayName));
            if(pattern && !this.patternCheck(key, pattern, displayName));
        }
    }

    async validateFormData(){
        console.log(this.formData);
        this.checkAll("first_name", "First Name", {"min": 3, "max": 50});
        this.checkAll("last_name", "Last Name", {"min": 3, "max": 50});
        this.checkAll("email", "Email", {"pattern": /^[a-zA-Z0-9]/});
        this.checkAll("phone", "Phone Number", {"pattern": /^[a-zA-Z0-9]/});
        this.checkAll("country", "Country", {});
        this.checkAll("province", "Province", {});
        this.checkAll("city", "City", {});
        this.checkAll("district", "District", {});
        this.checkAll("password", "Password", {"pattern": /^[a-fA-F0-9]/});

        if(this.debug) console.log(this.errors);
    }
}