export default function CustomInput({name, label, placeholder, type, required, error, pattern, maxLength, minLength, form}){
    return (
        <label htmlFor={name}>
            <span>{label}</span>
            <input className="border border-hover-black round" name={name} id={name} placeholder={placeholder} type={type} maxLength={maxLength} minLength={minLength} pattern={pattern} required={required || false}/>
            <span className="error" aria-live="polite">{error}</span>
        </label>
    );
}