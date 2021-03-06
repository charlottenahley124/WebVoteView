import time
import os
import json
import traceback
import math
from searchMembers import cqlabel
from searchParties import partyName, shortName
from searchMeta import metaLookup
from slugify import slugify
from pymongo import MongoClient
client = MongoClient()
try:
    dbConf = json.load(open("./model/db.json", "r"))
except:
    try:
        dbConf = json.load(open("./db.json", "r"))
    except:
        dbConf = {'dbname': 'voteview'}
db = client[dbConf["dbname"]]

m = metaLookup()
dimWeight = m['nominate']['second_dimweight']


def waterfallQuestion(rollcall):
    waterfall = ["vote_question", "question"]
    for w in waterfall:
        if w in rollcall and rollcall[w] is not None:
            return rollcall[w]

    return None


def waterfallText(rollcall):
    waterfall = ["vote_description", "vote_desc", "vote_document_text", "vote_title",
                 "vote_question_text", "amendment_author", "dtl_desc", "description", "short_description"]
    for w in waterfall:
        if w in rollcall and rollcall[w] is not None:
            return rollcall[w]

    return "Vote " + rollcall["id"]


def add_endpoints(mid, spread):
    """Add attributes to nomimate attribute that aid in
    drawing cutting lines
    """

    if (spread[0] == 0 and
        float(spread[1]) == 0 and
        float(mid[0]) == 0 and
            float(mid[1]) == 0):
        x = [0, 0]
        y = [0, 0]
        slope = None
        intercept = None
    elif abs(float(spread[1])) < 1e-16:
        x = [float(mid[0]), float(mid[0])]
        y = [-10, 10]
        slope = 1000
        intercept = -slope * (float(mid[0])
                              + float(mid[1]))
    else:
        slope = -float(spread[0]) / (float(spread[1]) * dimWeight * dimWeight)
        intercept = -slope * float(mid[0]) + float(mid[1])
        x = [10, -10]
        y = [intercept + slope * xx for xx in x]

    return slope, intercept, x, y


def _get_yeanayabs(vote_id):
    """
    Map vote ids with the proper values
    Yea -> [1..3], Nay -> [4..6], Abs -> [7..9]
    """
    if vote_id < 4:
        return "Yea"
    elif vote_id < 7:
        return "Nay"
    elif vote_id < 10:
        return "Abs"


def downloadAPI(rollcall_id, apitype="Web", voterId=0):
    starttime = time.time()
    # Setup API version response
    webexportapis = ["Web", "Web_Person", "exportJSON", "exportCSV"]

    if apitype in webexportapis:
        apiVersion = "Web 2016-10"
    elif apitype == "R":
        apiVersion = "R 2016-10"

    if not rollcall_id or len(rollcall_id) == 0:
        response = {'errormessage': 'No rollcall id specified.',
                    'apitype': apiVersion}
        return response

 # Split multiple ID requests into list
    if type(rollcall_id) == type([""]):
        rollcall_ids = rollcall_id
    elif "," in rollcall_id:
        rollcall_ids = [x.strip() for x in rollcall_id.split(",")]
    else:
        rollcall_ids = [rollcall_id]

 # Abuse filter
    maxVotes = 100
    if apitype in ["exportJSON", "exportCSV"]:
        maxVotes = 500
    if len(rollcall_ids) > maxVotes:
        response = {'errormessage': 'API abuse. Too many votes.',
                    'apitype': apiVersion}
        return response

    rollcall_results = []  # Stores top level rollcall results, one per vote
    errormessage = ""  # String storing error text
    errormeta = []  # List storing failed IDs

    found = {}
    for rid in rollcall_ids:
        found[rid] = 0

    setupTime = time.time()
    # Do we need to fold in members?
    peopleIds = []
    memberSet = []
    if apitype == "Web_Person":  # I need to fold in one specific member
        needPeople = -1  # Just one specific member
        peopleIds = [voterId]
    elif apitype == "exportCSV":
        needPeople = 0  # No members at all
    else:
        needPeople = 1
        peopleIds = db.voteview_rollcalls.distinct(
            "votes.icpsr", {"id": {"$in": rollcall_ids}})  # All relevant members

    congresses = []
    for rollcall_id in rollcall_ids:
        try:
            congresses.append(int(rollcall_id[2:5]))
        except:
            pass

    memberTime1 = time.time()
    # Now fetch the members
    memberSet = []
    if len(peopleIds):
        memberFields = {"icpsr": 1, "nominate": 1, "bioname": 1, "party_code": 1,
                        "state_abbrev": 1, "chamber": 1, "district_code": 1, "congress": 1, "id": 1}
        members = db.voteview_members.find(
            {"icpsr": {"$in": peopleIds}, "congress": {"$in": congresses}}, memberFields)
        for m in members:
            memberSet.append(m)

    memberTime2 = time.time()
    # Now iterate through the rollcalls
    fieldsNeeded = [
        'party_vote_counts', 'vote_title',
        'vote_desc', 'key_flags', 'yea_count', 'sponsor',
        'bill_number', 'id', 'description', 'tie_breaker', 'votes',
        'codes', 'dtl_desc', 'question', 'vote_description',
        'short_description', 'nay_count', 'congress',
        'vote_question_text', 'rollnumber', 'date',
        'vote_document_text', 'nominate', 'amendment_author',
        'chamber', 'vote_result', 'shortdescription', 'vote_question',
        'tie_breaker', 'cg_summary', 'cg_official_titles',
        'cg_short_titles_for_portions', 'dtl_sources', 'congress_url',
        'clerk_rollnumber',
    ]
    rollcalls = (
        db.voteview_rollcalls
        .find(
            {'id': {'$in': rollcall_ids}},
            {field: 1 for field in fieldsNeeded}
        )
        .sort('id')
        .batch_size(10)
    )
    for rollcall in rollcalls:
        result = []  # Hold new votes output, start blank
        try:
            # If we need some people, let's iterate through the voters and fill
            # them out
            if needPeople != 0:
                metaMembers = [m for m in memberSet if m[
                    "congress"] == rollcall["congress"]]
                for v in rollcall["votes"]:
                    newV = {}
                    # Only add the person if they're in our validated list of
                    # people we want.
                    if v["icpsr"] in peopleIds:
                        # print "In here"
                        newV.update(v)

                        # Do the match from the member list
                        try:
                            memberMap = next((m for m in metaMembers if m[
                                             "icpsr"] == v["icpsr"]), None)
                            if memberMap is None:
                                print v["icpsr"], "Error! We don't have a member with this icpsr. Skipping"
                        except:
                            print v["icpsr"], "Error! We don't have a member with this icpsr. Skipping"
                            continue

                        # Now assemble the matching.
                        if apitype == "Web" or apitype == "Web_Person" or apitype == "exportJSON":
                            newV["vote"] = _get_yeanayabs(newV["cast_code"])
                            # We are not returning cast code.
                            del newV["cast_code"]
                            try:
                                newV["x"] = memberMap["nominate"]["dim1"]
                            except:
                                pass
                            try:
                                newV["y"] = memberMap["nominate"]["dim2"]
                            except:
                                pass

                            if "prob" in newV:
                                try:
                                    newV["prob"] = int(round(newV["prob"]))
                                except:
                                    newV["prob"] = 0
                            newV["name"] = memberMap["bioname"]
                            try:
                                newV["seo_name"] = slugify(newV["name"])
                            except:
                                print "error can't slugify"
                                print traceback.format_exc()
                                pass

                            newV["party"] = partyName(memberMap["party_code"])
                            newV["party_short_name"] = shortName(
                                memberMap["party_code"])
                            newV["party_code"] = memberMap["party_code"]
                            newV["state_abbrev"] = memberMap["state_abbrev"]
                            if os.path.isfile("./static/img/bios/" + str(memberMap["icpsr"]).zfill(6) + ".jpg") or os.path.isfile("../static/img/bios/" + str(memberMap["icpsr"]).zfill(6) + ".jpg"):
                                newV["img"] = str(
                                    memberMap["icpsr"]).zfill(6) + ".jpg"
                            else:
                                newV["img"] = "silhouette.png"

                            if memberMap["state_abbrev"] == "USA":
                                newV["district"] = "POTUS"
                            elif memberMap["district_code"] > 70:
                                newV["district"] = "%s00" % memberMap[
                                    "state_abbrev"]
                            elif memberMap["district_code"] and memberMap["district_code"] <= 70:
                                newV["district"] = "%s%02d" % (
                                    memberMap["state_abbrev"], memberMap["district_code"])
                            else:
                                newV["district"] = ""
                        # And for the R API
                        elif apitype == "R" or apitype == "exportXLS":
                            try:
                                del newV["prob"]
                            except:
                                pass

                            if "nominate" in memberMap and "dim1" in memberMap["nominate"]:
                                newV["dim1"] = memberMap["nominate"]["dim1"]
                                newV["dim2"] = memberMap["nominate"]["dim2"]
                            newV["id"] = memberMap["id"]
                            newV["name"] = memberMap["bioname"]
                            newV["party_code"] = memberMap["party_code"]
                            newV["state_abbrev"] = memberMap["state_abbrev"]
                            newV["cqlabel"] = cqlabel(
                                memberMap["state_abbrev"], memberMap["district_code"])
                            newV['district_code'] = memberMap['district_code']
                        # Append the new voter to the list of voters.
                        result.append(newV)
                    else:
                        continue

            # Sort by ideology, and then identify the median and pivots
            if apitype == "Web":
                median = []
                pivotCopy = [
                    x for x in result if "x" in x and x["x"] is not None]
                pivotCopy = sorted(pivotCopy, key=lambda x: x["x"])
                if len(pivotCopy) % 2:
                    median = [
                        pivotCopy[int(math.ceil(len(pivotCopy) / 2)) - 1]["icpsr"]]
                else:
                    median = [pivotCopy[
                        (len(pivotCopy) / 2) - 1]["icpsr"], pivotCopy[(len(pivotCopy) / 2)]["icpsr"]]

                # Filibuster pivot
                fbPivot = []
                if rollcall["chamber"] == "Senate" and rollcall["congress"] >= 94 and len(pivotCopy) >= 60:
                    fbPivot = [pivotCopy[59]["icpsr"],
                               pivotCopy[len(pivotCopy) - 60]["icpsr"]]
                # Veto Override pivot
                numVotes = len(
                    [x for x in result if "vote" in x and x["vote"] != "Abs"])
                voPivotNum = int(
                    math.ceil(float(numVotes) * float(2) / float(3)))
                voPivot = [pivotCopy[voPivotNum]["icpsr"], pivotCopy[
                    len(pivotCopy) - voPivotNum - 1]["icpsr"]]

                for i in xrange(len(result)):
                    if result[i]["icpsr"] in median:
                        result[i]["flags"] = "median"
                    if result[i]["icpsr"] in fbPivot:
                        result[i]["flags"] = "fbPivot"
                    if result[i]["icpsr"] in voPivot:
                        result[i]["flags"] = "voPivot"

            # Top level nominate metadata
            # Debug code to delete nominate data so we can regenerate it.
            if "nominate" in rollcall and "slope" in rollcall["nominate"]:
                del rollcall["nominate"]["slope"]
            if "nominate" in rollcall and "intercept" in rollcall["nominate"]:
                del rollcall["nominate"]["intercept"]
            if "nominate" in rollcall and "x" in rollcall["nominate"]:
                del rollcall["nominate"]["x"]
            if "nominate" in rollcall and "y" in rollcall["nominate"]:
                del rollcall["nominate"]["y"]

            # Generate other nominate fields
            if "nominate" in rollcall and "mid" in rollcall["nominate"] and "spread" in rollcall["nominate"] and rollcall["nominate"]["spread"][0] is not None:
                rollcall["nominate"]["slope"], rollcall["nominate"]["intercept"], rollcall["nominate"]["x"], rollcall[
                    "nominate"]["y"] = add_endpoints(rollcall["nominate"]["mid"], rollcall["nominate"]["spread"])
            # Ensure everything has at least some nominate field.
            elif "nominate" not in rollcall:
                rollcall["nominate"] = {}

            # Flatten nominate for the R API.
            if apitype in webexportapis:
                nominate = rollcall['nominate']
                checkNom = ['classified', 'pre',
                            'log_likelihood', 'geo_mean_probability']
                for f in checkNom:
                    if f not in nominate:
                        nominate[f] = ''
            elif apitype == "R":
                if "nominate" in rollcall:
                    nominate = {"mid1": rollcall["nominate"]["mid"][0], "mid2": rollcall["nominate"]["mid"][1],
                                "spread1": rollcall["nominate"]["spread"][0], "spread2": rollcall["nominate"]["spread"][1],
                                "nomslope": rollcall['nominate']['slope'], 'nomintercept': rollcall['nominate']['intercept']}
                else:
                    nominate = {}

            # Top level rollcall item.
            found[rollcall["id"]] = 1

            # Get the best available description.
            description = waterfallText(rollcall)
            # Truncate the description for the R API.
            if apitype == "R" or apitype == "exportCSV":
                if len(description) <= 255:
                    pass
                else:
                    baseDesc = description[0:254]
                    rest = description[255:]
                    try:
                        cutoff = rest.index(". ")
                        if cutoff < 255:
                            baseDesc = baseDesc + rest[0:cutoff]
                        else:
                            baseDesc = baseDesc + rest[0:255] + "..."
                    except:
                        if len(rest) < 255:
                            baseDesc = baseDesc + rest
                        else:
                            baseDesc = baseDesc + rest[0:255] + "..."
                    description = baseDesc

            # Get the best available question
            question = waterfallQuestion(rollcall)
            if 'vote_result' not in rollcall:
                rollcall['vote_result'] = None

            # Collapse codes for R
            if apitype == "exportCSV" or apitype == "exportXLS":
                codeFields = {"Clausen1": "", "Issue1": "",
                              "Issue2": "", "Peltzman1": "", "Peltzman2": ""}
                if 'codes' in rollcall:
                    for key, value in rollcall["codes"].iteritems():
                        if len(value) == 1:
                            codeFields[key + '1'] = value[0]
                        else:
                            codeFields[key + '1'] = value[0]
                            codeFields[key + '2'] = value[1]
            elif apitype in webexportapis:
                if "codes" in rollcall:
                    codes = rollcall["codes"]
                else:
                    codes = {}
            elif apitype == "R":
                if "codes" in rollcall:
                    codes = rollcall["codes"]
                    for key, value in codes.iteritems():
                        codes[key] = '; '.join(value)
                else:
                    codes = {}

            # Pre-allocate keyvote flags.
            if not "key_flags" in rollcall:
                rollcall["key_flags"] = []

            # Output object:
            z = {key: rollcall.get(key)
                 for key in fieldsNeeded if key in rollcall}
            if "sponsor" in rollcall:
                z["sponsor"] = rollcall["sponsor"]
            if "bill_number" in rollcall:
                z["bill_number"] = rollcall["bill_number"]
            if "tie_breaker" in rollcall:
                z["tie_breaker"] = rollcall["tie_breaker"]
            if apitype == "exportCSV" or apitype == "exportXLS":
                z.update({k: v for k, v in codeFields.iteritems()})
                z.update({'keyvote': ''.join(rollcall['key_flags']),
                          'spread.dim1': nominate['spread'][0], 'spread.dim2': nominate['spread'][1],
                          'mid.dim1': nominate['mid'][0], 'mid.dim2': nominate['mid'][1],
                          'slope': nominate['slope'], 'intercept': nominate['intercept'],
                          'log_likelihood': round(nominate['log_likelihood'], 5),
                          'classified': nominate['classified'], 'pre': nominate['pre'],
                          'question': None if not question else question.encode('utf-8'),
                          'description': description.encode('utf-8'),
                          'geo_mean_probability': None if nominate['geo_mean_probability'] == '' else round(nominate['geo_mean_probability'], 3)})

            if apitype != "exportCSV":
                z.update({'key_flags': rollcall["key_flags"], 'votes': result, 'codes': codes,
                          'nominate': nominate, 'description': description, 'question': question})

            # Get other people's results from the party results aggregate.
            if apitype == "Web_Person":
                z["party_vote_counts"] = rollcall["party_vote_counts"]

            rollcall_results.append(z)

        except:  # Invalid vote id
            print traceback.format_exc()
            errormessage = "Invalid Rollcall ID specified."
            errormeta.append(str(rollcall["id"]))

    if rollcalls.count() != len(rollcall_ids):
        errormessage = "Invalid Rollcall ID specified."
        for voteID, num in found.iteritems():
            if num == 0:
                errormeta.append(str(voteID))

    endtime = time.time()
    # print round(setupTime-starttime,2), round(memberTime1-setupTime,2),
    # round(memberTime2-memberTime1,2), round(endtime-memberTime2,2)
    response = {}
    if len(rollcall_results):
        response["rollcalls"] = rollcall_results
    if len(errormessage):
        response["errormessage"] = errormessage
        if len(errormeta):
            response["errormeta"] = errormeta
    response["apitype"] = apiVersion
    response["elapsedTime"] = round(endtime - starttime, 3)
    return response


def downloadStash(id):
    if not id:
        return {"errormessage": "Invalid stash id.", "rollcalls": []}
    else:
        res = db.stash.find_one({"id": id})
        if not res or res is None:
            return {"errormessage": "Invalid stash id.", "rollcalls": []}
        else:
            voteIds = []
            if "old" in res:
                voteIds = voteIds + res["old"]
            if "votes" in res:
                voteIds = list(set(voteIds + res["votes"]))
            return downloadAPI(voteIds, apitype="exportJSON")

if __name__ == "__main__":
    # print downloadAPI("RS1140430")
    # print "=====Start 2"
    # print downloadAPI("RH1030301", "R")
    # print "=====Start 3"
    # print downloadAPI("RS0090027", "Web_Person", "09366")
    # print "=====Start 4"
    # print downloadAPI("RS1140473", "Web_Person",
    # "09366")["rollcalls"][0]["nominate"]
    print "=====Start 5"
    print downloadAPI(["RH0930002"], "Web")
    #print downloadAPI(["RH0800005", "RH1140005", "RH0310005", "RS0990005"], "R")
    pass
