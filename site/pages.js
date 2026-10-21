const inquiryForm=document.querySelector('#inquiry-form');
if(inquiryForm){
 const interest=new URLSearchParams(location.search).get('interest');
 if(interest&&Array.from(inquiryForm.elements.interest.options).some(o=>o.value===interest))inquiryForm.elements.interest.value=interest;
 function prepareInquiry(){
  if(!inquiryForm.reportValidity())return null;
  const d=Object.fromEntries(new FormData(inquiryForm));
  const subject=`Horizon inquiry: ${d.interest}`;
  const body=`Name: ${d.name}\nEmail: ${d.email}\nOrganization: ${d.organization||'Not provided'}\nArea: ${d.interest}\nBudget: ${d.budget}\nTimeline: ${d.timeline}\n\nProject details:\n${d.message}`;
  document.querySelector('#inquiry-preview').textContent=body;
  document.querySelector('#email-draft').href=`mailto:support@horizonforgesystems.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  document.querySelector('#email-ready').hidden=false;
  return body;
 }
 inquiryForm.addEventListener('submit',e=>{e.preventDefault();if(prepareInquiry()){document.querySelector('#form-status').textContent='Your inquiry is prepared. Use “Open email app” below to review and send it.';document.querySelector('#email-draft').focus();}});
 document.querySelector('#copy-inquiry').addEventListener('click',async()=>{const body=prepareInquiry();if(!body)return;try{await navigator.clipboard.writeText(body);document.querySelector('#form-status').textContent='Copied. Paste your inquiry into an email to support@horizonforgesystems.com.';}catch{document.querySelector('#form-status').textContent='Copy is unavailable here. Expand “View your prepared inquiry” below and copy the text manually.';document.querySelector('#email-ready details').open=true;}});
}
