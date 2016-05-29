% STATIC_URL = "/static/"
% rebase('base.tpl',title='Plot Vote', extra_css=["map.css","scatter.css"], extra_js=["/static/js/saveSvgAsPng.js"])
% include('header.tpl')
% rcSuffix = lambda n: "%d%s" % (n,"tsnrhtdd"[(n/10%10!=1)*(n%10<4)*n%10::4])
<div class="container">
	<div class="row">
		<div class="col-md-12">
			<h3>
				<abbr title="Congress"><a href="/search/?congress={{ rollcall["congress"] }}">{{ rcSuffix(rollcall["congress"]) }} Congress</a></abbr> &gt;
				<abbr title="Chamber"><a href="/search/?congress={{ rollcall["congress"] }}&chamber={{ rollcall["chamber"] }}">{{ rollcall["chamber"] }}</a></abbr> &gt;
				<abbr title="Rollnumber">Vote {{ rollcall["rollnumber"] }}</abbr>
			</h3>
			<p style="float:left;margin-right:20px;"><strong>Date:</strong> {{ rollcall["date"] }}</p>
			% if len(rollcall["code"]["Clausen"]):
			<p style="float:left;">
				<strong>Vote Subject Matter:</strong> {{ rollcall["code"]["Clausen"][0] }} / {{ rollcall["code"]["Peltzman"][0] }}
			</p>
			% end
			<p style="clear:both;">{{ rollcall["description"] }}</p>
		</div>
	</div>

	<div class="row" id="loadBar">
		<div class="col-md-12">
			<h4>
				Loading 
				<img src="/static/img/loading.gif" style="margin-left:10px;width:24px;vertical-align:middle;">
			</h4>
			We are currently constructing the map and plots you requested, please wait...
		</div>
	</div>

	<div class="row" id="errorContent" style="display:none;">
		<div class="col-md-12">
			<h4>Error!</h4>
			<div class="errorMessage"></div>
		</div>
	</div>

	<div style="display:none;" id="loadedContent">

		<div class="row">
			<div class="col-md-9">
				<h4 style="float:left;clear:none;vertical-align:middle;">
					Vote Map 

					<a href="#" onclick="javascript:saveSvgAsPng($('#map-chart > svg')[0],'vote_map_{{rollcall["chamber"][0]}}{{rollcall["congress"]}}{{str(rollcall["rollnumber"]).zfill(4)}}.png', {backgroundColor: 'white'});return false;">						
						<img src="/static/img/save.png" style="margin-left:5px;width:22px;vertical-align:middle;" data-toggle="tooltip" data-position="bottom" data-html="true" title="Save Map as PNG">
					</a>

					%if int(rollcall["congress"])<86:
						<img style="margin-left:5px;width:22px;vertical-align:middle;" src="/static/img/help.png" data-toggle="tooltip" data-position="bottom" data-html="true" title="<u>Note</u><br/>States as of {{ rcSuffix(rollcall["congress"]) }} Congress.">
					%end

					<!--Zoom: 
					<button id="zoomOut">-</a> 
					<button id="zoomIn">+</a>-->

				</h4>
				</span>

				<span id="map-chart" style="margin-top:10px; padding: 10px; vertical-align:bottom;">
					<span id="suppressMapControls" style="display:none;"><span class="filter"></span></span>
				</span>
			</div>
			<div class="col-md-3">
				<h4>Votes <a href="#" onclick="javascript:updateVoteChart();">(Test)</a></h4> 
				<div id="party-chart">
					<span id="suppressVoteChartControls" style="display:none;"><span class="filter"></span></span>
				</div>
			</div>
		</div>

		<div class="row" style="margin-bottom:20px;">
			<div class="col-md-12">
				<h4>DW-Nominate Cut-Line for Vote
					<a href="#" onclick="javascript:saveSvgAsPng($('#scatter-chart > svg')[0],'dw_nominate_{{rollcall["chamber"][0]}}{{rollcall["congress"]}}{{str(rollcall["rollnumber"]).zfill(4)}}.png', {backgroundColor: 'white'});return false;">
						<img src="/static/img/save.png" style="margin-left:5px;width:22px;vertical-align:middle;" data-toggle="tooltip" data-position="bottom" data-html="true" title="Save Map as PNG">
					</a>
				</h4>

				<div id="scatter-container" style="margin:0 auto 0 auto;">
					<div id="scatter-bg">
						<svg id="svg-bg"></svg> 
					</div>
					<div id="scatter-chart">
						<span id="suppressNominateControls" style="display:none;"><span class="filter"></span></span>
					</div>
				</div>
			</div>
		</div>

		<div class="row" style="margin-bottom:50px;">
			<div class="col-md-12">
				<div>
					<h4 style="float:left;padding-right:20px;">Vote List</h4>
					<span style="vertical-align:bottom;">
						(Sort by 
						<a href="#" onclick="javascript:outVotes('party');return false;">Party</a>, 
						<a href="#" onclick="javascript:outVotes('state');return false;">State</a>, 
						<a href="#" onclick="javascript:outVotes('vote');return false;">Vote</a>)
					</span>
				</div>
				<div id="voteList"></div>
			</div>
		</div>
	</div>
</div>

<div id="selectionFilterBar" style="z-index: 99;position:fixed; bottom:0px; height:40px; left:0px; width:100%; background-color:#EEEEEE; padding: 10px; border-top:1px solid black; display:none; ">
	<strong>Selected:</strong> 
	<span id="data-count"><span class="filter-count"></span> of <span class="total-count"></span> <span id="votertype"></span></span>
	<span id="map-chart-controls" style="display:none;"> from <span class="filter"></span></span>
	<span id="vote-chart-controls" style="display:none;"> including <span class="filter"></span></span>
	<span id="nominate-chart-controls" style="display:none;"> with NOMINATE scores within <span class="filter"></span></em></span>. 
	<span id="sparse-selection" style="display:none;"></span>
	<a class="reset" href="javascript:doFullFilterReset();">Remove Filter</a>
</div>

<script type="text/javascript">
// Pass this in.
var chamber = "{{ rollcall["chamber"] }}";
var congressNum = "{{ str(rollcall["congress"]).zfill(3) }}";
var rcID = "{{ rollcall["id"] }}";
</script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/sprintf.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/queue.v1.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/d3.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/crossfilter.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/dc.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/d3.tip.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/topojson.v1.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/decorate.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/setupDC.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/voteTable.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/dc_filterbar.js"></script>
<script type="text/javascript">
function doZoom()
{
	//console.log(d3.event.target);
	
	d3.event.preventDefault();
	return false;
	/*zoomLevel=zoomLevel + 0.25*dir;
	if(zoomLevel>3) zoomLevel=3;
	if(zoomLevel<1) zoomLevel=1;

	var mapG = d3.select("#map-chart svg g");
	var translation = -500 * zoomLevel;
	console.log(translation);
	var translation = "-50%";
	mapG.transition().duration(350).attr("transform","translate("+translation+", 0)");
	// scale("+zoomLevel+")");
	return false;*/
}

// Use this to extract offsets from vote party chart in order to insert category labels.
function splitTranslate(text)
{
	return(parseInt(text.split(",")[1].split(")")[0]));
}

// Update vote party chart in order to insert category labels.
function updateVoteChart() 
{
	return;
	var voteChartSVG = $("#party-chart > svg");
	if(d3.selectAll("#party-chart > svg > g >g.label").length)
	{
		d3.selectAll("#party-chart > svg > g > g.label").remove();	
	}

	var scanFor = ["Yea", "Nay", "Abs", "NA end"];
	var scanMap = ["Voting Yea", "Voting Nay", "Absent", ""];
	var scanIndex = 0;
	var translateAdj = 0;
	var newMax = 0;
	voteChartSVG.children("g").children("g").each(function(index, item) {
		var tChildren = $(this).children("title").text();
		if(tChildren.length && tChildren.startsWith(scanFor[scanIndex]))
		{
			var currentTranslate = splitTranslate($(this).attr("transform")) + translateAdj;
			d3.select("#party-chart > svg > g").insert("g")
				.attr("class","label").attr("transform","translate(0,"+currentTranslate+")")
				.append("text").attr("font-size","12px").attr("x","6").attr("y","12").attr("dy","0.35em").html(scanMap[scanIndex]);
			translateAdj = translateAdj+34;
			scanIndex=scanIndex+1;
		}
		if($(this).attr("class")!="label")
		{
			newMax = splitTranslate($(this).attr("transform"))+translateAdj;
			$(this).attr("transform","translate(0,"+newMax+")");
		}
	});

	voteChartSVG.children("g").children(".axis").attr("transform","translate(0,"+(newMax+34)+")");
	voteChartSVG.attr("height",(newMax+68));
	return 0;
}

// Easier to update steps to take on a full filter reset by running this.
function doFullFilterReset()
{
	$("#selectionFilterBar").slideUp();
	dc.filterAll();
	dc.redrawAll();
	decorateNominate(nominateScatterChart, globalData);
	//updateVoteChart();
}

</script>
