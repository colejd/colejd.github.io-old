function UnityProgress(e){this.progress=0,this.message="",this.dom=e;var s=e.parentNode,t=document.createElement("div");if(t.style.background=Module.backgroundColor?Module.backgroundColor:"#4D4D4D",t.style.position="absolute",t.style.overflow="hidden",s.appendChild(t),this.background=t,Module.backgroundImage){var i=document.createElement("img");i.src=Module.backgroundImage,i.style.position="absolute",i.style.width="100%",i.style.height="auto",i.style.top="50%",i.style.transform="translate(0, -50%)",t.appendChild(i)}var o=document.createElement("img"),r=Module.splashStyle?Module.splashStyle:"Light";o.src="TemplateData/Logo."+r+".png",o.style.position="absolute",s.appendChild(o),this.logoImage=o;var a=document.createElement("img");a.src="TemplateData/ProgressFrame."+r+".png",a.style.position="absolute",s.appendChild(a),this.progressFrame=a;var h=document.createElement("div");h.style.position="absolute",h.style.overflow="hidden",s.appendChild(h),this.progressBar=h;var l=document.createElement("img");l.src="TemplateData/ProgressBar."+r+".png",l.style.position="absolute",h.appendChild(l),this.progressBarImg=l;var g=document.createElement("p");g.style.position="absolute",s.appendChild(g),this.messageArea=g,this.SetProgress=function(e){this.progress<e&&(this.progress=e),this.messageArea.style.display="none",this.progressFrame.style.display="inline",this.progressBar.style.display="inline",this.Update()},this.SetMessage=function(e){this.message=e,this.background.style.display="inline",this.logoImage.style.display="inline",this.progressFrame.style.display="none",this.progressBar.style.display="none",this.Update()},this.Clear=function(){this.background.style.display="none",this.logoImage.style.display="none",this.progressFrame.style.display="none",this.progressBar.style.display="none"},this.Update=function(){this.background.style.top=this.dom.offsetTop+"px",this.background.style.left=this.dom.offsetLeft+"px",this.background.style.width=this.dom.offsetWidth+"px",this.background.style.height=this.dom.offsetHeight+"px";var e=new Image;e.src=this.logoImage.src;var s=new Image;s.src=this.progressFrame.src,this.logoImage.style.top=this.dom.offsetTop+(.5*this.dom.offsetHeight-.5*e.height)+"px",this.logoImage.style.left=this.dom.offsetLeft+(.5*this.dom.offsetWidth-.5*e.width)+"px",this.logoImage.style.width=e.width+"px",this.logoImage.style.height=e.height+"px",this.progressFrame.style.top=this.dom.offsetTop+(.5*this.dom.offsetHeight+.5*e.height+10)+"px",this.progressFrame.style.left=this.dom.offsetLeft+(.5*this.dom.offsetWidth-.5*s.width)+"px",this.progressFrame.width=s.width,this.progressFrame.height=s.height,this.progressBarImg.style.top="0px",this.progressBarImg.style.left="0px",this.progressBarImg.width=s.width,this.progressBarImg.height=s.height,this.progressBar.style.top=this.progressFrame.style.top,this.progressBar.style.left=this.progressFrame.style.left,this.progressBar.style.width=s.width*this.progress+"px",this.progressBar.style.height=s.height+"px",this.messageArea.style.top=this.progressFrame.style.top,this.messageArea.style.left=0,this.messageArea.style.width="100%",this.messageArea.style.textAlign="center",this.messageArea.innerHTML=this.message},this.Update()}