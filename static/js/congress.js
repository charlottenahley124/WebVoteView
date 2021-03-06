var updateFilterTimer;
var resultCache;
var validSet;
var sortBy;
var nameDimension;
var nominateScatterChart = dc.scatterPlot("#scatter-chart");
var baseTip = d3.select("body").append("div").attr("class", "d3-tip").style("visibility","hidden").attr("id","mapTooltip");
var eW;

// From stackoverflow response, who borrowed it from Shopify--simple ordinal suffix.
function getGetOrdinal(n) {
    var s=["th","st","nd","rd"],
    v=n%100;
    return n+(s[(v-20)%10]||s[v]||s[0]);
 }

$(document).ready(function()
{
	var done = 0;
	$("#congSelector").change(reloadBios);
	congressNum = $("#congSelector").val();	
	if(storageAvailable("localStorage"))
	{
		var data = localStorage.getItem("congress_" + congressNum + "_chamber_" + chamber_param);
		if(data != null)
		{
			var parseData = JSON.parse(data);
			if(new Date().getTime() <= Date.parse(parseData["date"]))
			{
				console.log("Loaded from localStorage");
				resultCache = parseData["data"];

				$('#content').show();
				$('#loading-container').hide();
				doInit();
				return;
			}
		}
	}

	$.ajax({
		dataType: "JSON",
		url: "/api/getmembersbycongress?congress="+congressNum+"&chamber="+chamber_param+"&api=Web_Congress",
		success: function(data, status, xhr)
		{
			resultCache = data;
			if(storageAvailable("localStorage"))
			{
				try
				{
					var expireDate = new Date(new Date().getTime() + (24 * 60 * 60 * 1000));
					localStorage.setItem("congress_" + congressNum + "_chamber_" + chamber_param, JSON.stringify({"date": expireDate, "data": data}));
				}
				catch(e) { console.log(e); }
			}

			$('#content').fadeIn();
			$('#loading-container').slideUp();
			doInit()
		}
	});

});

function doReinit(data)
{
	validSet = [];
	resultCache = data;
	$("#sortChamber").unbind('click')
	$("#sortChamber").click(function() { resort('elected_'+chamber_param); return false; });
	$("#textLink").attr("href", "/congress/" + chamber_param + "/" + congressNum + "/text");
	$("#graphicLink").attr("href", "/congress/" + chamber_param + "/" + congressNum);

	doInit();
}

function doInit()
{
	if(!tabular_view) { writeBioTable(); nomPlot(); }
	else { writeTextTable(); }
	compositionBar();

}

function nomPlot()
{
	var ndx = crossfilter(resultCache["results"]);
	var all = ndx.groupAll();
	var xDimension = ndx.dimension(
		function(d) 
	        {
			if(d["nominate"] == undefined || d["nominate"]["dim1"] == undefined || (d.nominate.dim1**2 + d.nominate.dim2**2 > 1.99))
	   	        {
				var x = -999;
				var y = -999;
			}
			else
		        {
				var x = d.nominate.dim1;
				var y = d.nominate.dim2;
			}
			return [x,y];
		}
	);
	nameDimension = ndx.dimension(
		function(d)
		{
			return d["bioname"];
		}
	);
	var xGroup = xDimension.group().reduce(
		function(p, d)
		{
			p.members.push(d);
			return p;
		},
	
		function(p, d)
		{
			var index = p.members.indexOf(d);
			if(index > -1) { p.members.splice(index, 1); }
			return p;
		},
	
		function() { return {members: []} ; }
	);

    nominateScatterChart
        .clipPadding(4)
        .transitionDuration(250) // JBL:Speed up symbol size changes on brush per AB request
	.width(890)
	.height(790*nomDWeight+100)
	.margins({top:25,right:25,bottom:75,left:75})
	.dimension(xDimension)
	.mouseZoomable(false)
	.group(xGroup)
	.data(function(group) { return group.all().filter(function(d) { return d.key!=[999,999]; });})
	.symbolSize(7)
	.colorCalculator(function(d) {
		var color = "#CCC";
		try {
			if(d.value.members.length > 0){
				color = blendColors(d.value.members);
			}
		}catch(e){
			console.log(e);
		}
		return color;
	})
	.highlightedSize(10)
	.x(d3.scale.linear().domain([-1.0,1.0]))
	.y(d3.scale.linear().domain([-1.0,1.0]));

	nominateScatterChart.on("filtered", function()
	{
		if(updateFilterTimer) { clearTimeout(updateFilterTimer); }
		updateFilterTimer = setTimeout(function()
		{
			var filterSelect= xDimension.top(Infinity);
			validSet = [];
			for(var i in filterSelect)
			{
				validSet.push(filterSelect[i].icpsr);
			}
			hasFilter=1;
			hideMembersUnselected();
			do_filter_bar();
		}, 300);
	});

	dc.filterAll();
	dc.renderAll();
        decorateNominate(nominateScatterChart, resultCache);

        // Make brush box appear on click
        var scb = nominateScatterChart.select(".brush");
        scb.on('click', function(){
  	  var extent = nominateScatterChart.brush().extent();
	  var x = nominateScatterChart.x().invert(d3.mouse(this)[0]),
	      y = nominateScatterChart.y().invert(d3.mouse(this)[1]);
	  // Only draw box if there isn't one already there...
 	  if (extent[0][0]==extent[1][0] & extent[0][1]==extent[1][1]) {
	      if (x*x + y*y <= 1) {
		  var insideBox = $.grep(nominateScatterChart.data(), function(n, i) {
			return (n["value"]["members"][0]["nominate"]["dim1"] >= x-0.025 &&
				n["value"]["members"][0]["nominate"]["dim1"] <= x+0.025 &&
				n["value"]["members"][0]["nominate"]["dim2"] >= y-0.025/nomDWeight &&
				n["value"]["members"][0]["nominate"]["dim2"] <= y+0.025/nomDWeight);
		 });
		if(insideBox.length) { nominateScatterChart.brush().extent([[x-0.025,y-0.025/nomDWeight],[x+0.025,y+0.025/nomDWeight]]).event(scb); }
		else { nominateScatterChart.brush().extent([[x,y],[x,y]]).event(scb); }
	      } else {
		  nominateScatterChart.brush().extent([[x,y],[x,y]]).event(scb);
	      }
	  }
        });
}

function rechamber()
{
	if(chamber_param=="house") { chamber = "senate"; chamber_param="senate"; $("#memberLabel").html("Senators"); }
	else { chamber = "house"; chamber_param="house"; $("#memberLabel").html("Representatives"); }
	reloadBios();
}

function reloadBios()
{
	congressNum = $("#congSelector").val();

	if(storageAvailable("localStorage"))
	{
		var data = localStorage.getItem("congress_" + congressNum + "_chamber_" + chamber_param);
		if(data != null)
		{
			var parseData = JSON.parse(data);
			if(new Date().getTime() <= Date.parse(parseData["date"]))
			{
				console.log("Loaded from localStorage");
				if(!tabular_view) doFullFilterReset();
				doReinit(parseData["data"]);
				return;
			}
		}
	}

	$.ajax({
		dataType: "JSON",
		url: "/api/getmembersbycongress?congress="+congressNum+"&chamber="+chamber_param+"&api=Web_Congress",
		success: function(data, status, xhr)
		{
			if(storageAvailable("localStorage"))
			{
				try
				{
					var expireDate = new Date(new Date().getTime() + (24 * 60 * 60 * 1000));
					localStorage.setItem("congress_" + congressNum + "_chamber_" + chamber_param, JSON.stringify({"date": expireDate, "data": data}));
				}
				catch(e) { console.log(e); }
			}

			if(!tabular_view) doFullFilterReset();
			doReinit(data);
		}
	});
}

function getVPP(congress)
{
	// This is a hack; we just list thresholds at which the VP/ President of the Senate switches
	var VPParty = {	"115": "Republican", "111": "Democrat", "107": "Republican", "103": "Democrat", 
			"97": "Republican", "95": "Democrat", "91": "Republican", "87": "Democrat", 
			"83": "Republican", "81": "Democrat", "80": "Vacant", "73": "Democrat", 
			"67": "Republican", "63": "Democrat", "59": "Republican", "58": "Vacant", 
			"55": "Republican", "53": "Democrat", "51": "Republican", "50": "Vacant", 
			"49": "Democrat", "48": "Vacant", "41": "Republican", "40": "Vacant", 
			"39": "Democrat", "37": "Republican", "35": "Democrat", "34": "Vacant", 
			"33": "Democrat", "32": "Vacant", "31": "Whig", "29": "Democrat", 
			"28": "Vacant", "27": "Whig", "25": "Democrat", "20": "Jackson", 
			"15": "Democrat-Republican", "14": "Vacant", "5": "Democrat-Republican", 
			"4": "Federalist", "1": "Pro-Administration"};

	// Sort the dict keys and reverse them so the short-circuit in the loop below works
	var keys = Object.keys(VPParty);
	keys.reverse();

	// Iterate through keys until we find the bucket we're in
	for(var i=0;i!=keys.length;i++)
	{
		// We just return party name.
		if(parseInt(keys[i])<=parseInt(congress)) { return VPParty[keys[i]]; }
	}
}

function compositionBar()
{
	var partyCount={}
	$.each(resultCache["results"], function(i, d) {
		if(partyCount[d.party_short_name]==undefined) { partyCount[d.party_short_name]=1; }
		else { partyCount[d.party_short_name]++; }
	});

	var chartWidth = Math.min(300, Math.max(200,Math.round($("#content").width()*0.27)));
	
	$("#partyComposition").html("");
	var svgBucket = d3.select("#partyComposition").append("svg").attr("width",chartWidth).attr("height",21);
	var x=0; 
	var sorted_parties = Object.keys(partyCount).sort();
	
	var baseTipT = "<strong>Party Composition of "+getGetOrdinal(congressNum)+" "+chamber_param.substr(0,1).toUpperCase()+chamber_param.substr(1)+"</strong><br/>";
	var maxN = 0; var maxP = 0; var sumSet=0;
	for(pNi in sorted_parties)
	{
		pN = sorted_parties[pNi];
		if(partyCount[pN]>maxN || (partyCount[pN]==maxN && pN==getVPP(congressNum) && chamber_param=="senate")) { maxN=partyCount[pN]; maxP = pN; }
		var wid = Math.round(chartWidth*(partyCount[pN]/resultCache["results"].length));
		try {var voteCol = colorSchemes[partyColorMap[partyNameSimplify(pN)]][0]; } catch(e) { var voteCol = '#000000'; }
		var rect = svgBucket.append("rect")
				.attr("x",x).attr("y",3).attr("width",wid).attr("height",15)
				.attr('class',partyColorMap[partyNameSimplify(pN)])
				//.attr("fill",voteCol)
				.attr("stroke","#000000").attr("stroke-width",1);
		x=x+wid;
		baseTipT += '<br/>'+pN+': '+partyCount[pN];
		if(chamber_param=="senate" && pN==getVPP(congressNum)) { baseTipT += " (+ Vice President)"; }
	}
	baseTipT+= "<br/><br><em>Note:</em> Counts include members elected through special elections after resignations, deaths, or vacancies.";
	svgBucket.on('mouseover',function(d) { 
		baseTip.html(baseTipT);
		$('#mapTooltip').removeClass().addClass('d3-tip')
				.addClass(partyColorMap[partyNameSimplify(maxP)]);
		eW = baseTip.style('width');
		baseTip.style('visibility','visible');
	}).on('mousemove',function(d) {
		baseTip.style("top",(event.pageY+20)+"px").style("left", (event.pageX-(parseInt(eW.substr(0,eW.length-2))/2))+"px");
	}).on('mouseout',function(d) { baseTip.style('visibility','hidden'); });
}

var delay_filter_timeout = null;
function delay_filter() 
{
	if(delay_filter_timeout) { clearTimeout(delay_filter_timeout); }
	delay_filter_timeout = setTimeout(do_search_name_filter, 100);
}

var icpsr_match = [];
function do_search_name_filter() 
{
	if($("#filter_name").val() != undefined && $("#filter_name").val().length) {
		var current_filter = $("#filter_name")[0].value.toLowerCase().replace(/[^0-9a-z ]/gi, '').split(" ");
		var which_include = $.grep(resultCache["results"], function(d, i) {
			for(var i=0; i!=current_filter.length; i++) {
				if(d["bioname"].toLowerCase().replace(/[^0-9a-z ]/gi, '').indexOf(current_filter[i]) == -1) { return false; }
			}
			return true;
		});

		icpsr_match = [];
		for(var i=0; i!=which_include.length; i++)
		{
			icpsr_match.push(which_include[i]["icpsr"]);
		}

		var regex = new RegExp($("#filter_name")[0].value, "i")
		nameDimension.filter(function(d) {
			return d.search(regex) != -1;
		});
	}
	else
	{
		nameDimension.filterAll();
	}

	dc.redrawAll();
	do_filter_bar();
	hideMembersUnselected();
}

function hideMembersUnselected()
{
	$("#memberList > li.memberResultBox").each(function(i, d) {
		var show_brush = validSet.length == 0 || validSet.indexOf(parseInt($(d).attr("id"))) != -1;
		var show_text = $("#filter_name")[0].value.length == 0 || icpsr_match.indexOf(parseInt($(d).attr("id"))) != -1;
		if(show_brush && show_text) { $(d).show(); }
		else { $(d).hide(); }
	});

        // Set number of columns by number of selected members
	var colNumber = validSet.length ? Math.min(4, Math.floor(validSet.length / 5) + 1) : "";
	if(colNumber) $("#memberList").removeClass().addClass("clearfix").addClass("column" + colNumber);
}

function do_filter_bar() 
{
	// Proper diction for text
	if(chamber=="house")
	{
		var voterName = "Representatives";
	}
	else
	{
		var voterName = "Senators";
	}
	$("#votertype").text(voterName);

	var baseFilter = 0;

	// Show the NOMINATE filter selected
	var nominateFilter = $("#suppressNominateControls > .filter").text();
	if(nominateFilter.length)
	{
		// Round coordinates to 2 sig figs.
		var coordSets = nominateFilter.split(" -> ");
		var initXY = coordSets[0].split(",");
		var endXY = coordSets[1].split(",");
		initXY[0] = parseFloat(initXY[0].substr(1)).toPrecision(2);
		initXY[1] = parseFloat(initXY[1]).toPrecision(2);
		endXY[0] = parseFloat(endXY[0].substr(0,endXY[0].length-1)).toPrecision(2);
		endXY[1] = parseFloat(endXY[1]).toPrecision(2);
		var resultText = "(" + initXY[0] + ", " + initXY[1] + ") to (" + endXY[0] + ", " + endXY[1] + ")";

		$("#nominate-chart-controls > .filter").text(resultText);
		$("#nominate-chart-controls").show();
		baseFilter = 1;
	}
	else
	{
		$("#nominate-chart-controls").hide();
	}

	// Filters for name selected
	if($("#filter_name").val().length) 
	{
		$("#name-controls > .filter").text($("#filter_name")[0].value);
		$("#name-controls").show();	
		baseFilter = 1;
	}
	else
	{
		$("#name-controls").hide();
	}


	// Show the filter bar
	if(baseFilter)
	{
		$("#selectionFilterBar").slideDown(300, function()
		{
			$("#selectionFilterClose").fadeIn(200);
		});
	}
	else
	{
		$("#selectionFilterClose").fadeOut(100, function()
		{
			$("#selectionFilterBar").slideUp(300);
		});
	}
}

function doFullFilterReset()
{
	$("#selectionFilterBar").slideUp();
	$("#suppressNominateControls > .filter").text("");
	$("#filter_name").val("");
	do_search_name_filter();
	dc.filterAll();
	dc.redrawAll();
	hideMembersUnselected();
}

