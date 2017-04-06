( function( $, History, undefined ) {

	if ( !History.enabled ) {
		return false;
	}

	var $wrap = $( "#wrap" );

	$wrap.on( "click", ".page-link", function( event ) {
        console.log("oh jeez");
		event.preventDefault();

		attemptVisit(this);

	} );

    $(".nav-side-menu li").on( "click", function( event ) {
        var link = this.getElementsByTagName("a")[0];
        if(link !== undefined && link.href != ""){
            console.log("Clicked");
            attemptVisit(link);
        }

    });

    function attemptVisit(linkElement){
        if ( window.location === linkElement.href ) {
			return;
		}

		var pageTitle = ( linkElement.title ) ? linkElement.title : linkElement.textContent;
			pageTitle = ( linkElement.getAttribute( "rel" ) === "home" ) ? pageTitle : pageTitle + " — Acme";

		History.pushState( null, pageTitle, linkElement.href );
    }

//    $(".nav-side-menu li").click(function(){
//        //event.preventDefault();
//        var clicked = $(this).find("a");
//        console.log(clicked);
//        if(clicked !== undefined && clicked.length){
//            //window.location= clicked;
//            var pageTitle = ( clicked.title ) ? clicked.title : clicked.textContent;
//			pageTitle = ( clicked.getAttribute( "rel" ) === "home" ) ? pageTitle : pageTitle + " — Acme";
//
//		    History.pushState( null, pageTitle, clicked.attr("href") );
//        }
//    });

	History.Adapter.bind( window, "statechange", function() {
        console.log("State changed");
		var state = History.getState();

		$.get( state.url, function( res ) {
			$.each( $( res ), function( index, elem ) {

				if ( $wrap.selector !== "#" + elem.id ) {
                    console.log("Return");
					return;
				}
                console.log("Loaded new html");

				$wrap.html( $( elem ).html() );
			} );
		} );
	} );

} )( jQuery, window.History );
