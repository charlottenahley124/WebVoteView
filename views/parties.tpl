% STATIC_URL = "/static/"
% rebase('base.tpl', title='Parties', extra_css=['map.css'])
% include('header.tpl')

<div class="container">
	
	<div id="loading-container">
		<h3>Now loading. . .&nbsp;&nbsp;
			<img src="{{ STATIC_URL }}img/loading.gif" />
		</h3>
	</div>
	
	<div id="content">
		<div class="row">
			<div class="col-md-12">
				<h3>
					<abbr title="parties"><a href="/parties/all">Parties</a></abbr> &gt; 
					<span class="partyName">Party {{ party }}</span> Party
				</h3>

				<h4>
					Median <span class="partyName">Party {{ party }}</span> Party ideology over time<small><a class="reset" href="javascript:dimChart.filterAll();dc.redrawAll();" style="display: none;">reset</a></small>
				</h4>
				<div id="dim-chart"></div>
			</div>
		</div>
		<div class="row" style="padding-bottom:30px;">
			<div class="col-md-12">
				<h4><span class="partyName">Party {{ party }}</span> Geographical Distribution over time</span></h4>
				<div style="float:left;" id="party-map-chart"></div>
				<div style="float:left;">
					<strong>Filter: Chamber Control</strong><br/>
					<select onChange="javascript:toggleMapSupport(this.options[this.selectedIndex].value);">
						<option value="both">Both</option>
						<option value="senate">Senate Only</option>
						<option value="house">House Only</option>
					</select><br/><br/>

					<strong>Filter: Congress Number</strong><br/>
					<input type="text" id="congNum" style="width:50px;">
					<input type="button" onClick="javascript:switchCongress($('#congNum').val());" value="Switch">
				</div>
			</div>
		</div>
		<div class="row">
			<div class="col-md-12">
				<h4>Number of <span class="partyName"> {{ party }}</span>s elected over time <small><a class="reset" href="javascript:timeChart.filterAll();dc.redrawAll();" style="display: none;">reset</a></small></h4>
				<div id="time-chart"></div>
			</div>
		</div>
	</div>
</div>

<script language="javascript">var party_param = "{{ party }}";</script>
<script language="javascript">var mapParties=1;</script>
<script language="javascript">var congressNum=114;</script>
<script type="text/javascript" src="{{ STATIC_URL }}js/colorMap.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/d3.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/crossfilter.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/queue.v1.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/topojson.v1.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/simple-statistics.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/libs/dc.min.js"></script>
<script type="text/javascript" src="{{ STATIC_URL }}js/party.js"></script>

