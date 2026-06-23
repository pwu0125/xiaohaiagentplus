#!/usr/bin/env python3
"""
COB-REval Web Server — 商业不动产资产评价系统
Flask server: PDF上传 → 信息提取 → 消费类对标评估 → 展板输出
"""
from flask import Flask, jsonify, send_from_directory, request
import csv
import functools
import json
import os
import sqlite3
import tempfile
import shutil
from pathlib import Path

app = Flask(__name__, static_folder='static', static_url_path='/static')
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / 'data'
STATIC_DIR = BASE_DIR / 'static'
UPLOAD_DIR = BASE_DIR / 'uploads'
STATIC_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

# Import evaluation engine
import sys
sys.path.insert(0, str(BASE_DIR))
from evaluation_engine import evaluate_project
from pdf_extractor import extract_from_pdf

# ─── REITs 数据预加载 ───

_reits_index = None  # Lazy-loaded search index

def _load_reits_index():
    """预加载87只REITs可搜索信息"""
    global _reits_index
    if _reits_index is not None:
        return _reits_index
    
    _reits_index = {}
    
    # Industry mapping
    industry_map = {}
    for ind, codes in {
        "产业园": ["180101","180102","180103","180104","180105","180106","508000","508003","508009","508011","508019","508027","508029","508039","508080","508088","508089","508092","508099"],
        "仓储物流": ["180301","180302","180303","180304","180305","180306","508021","508022","508048","508056","508084","508090","508098"],
        "消费": ["180601","180602","180603","180604","180605","180606","180607","508002","508005","508017","508082","508091","508600","508602","508603"],
        "保租房": ["180501","180502","180503","508031","508055","508058","508068","508077","508085"],
        "高速公路": ["180201","180202","180203","180204","180205","180206","180207","180208","180209"],
        "能源": ["180401","180402","180403","180404","180405","508097"],
        "环保": ["180701","180702","180703","508006","508007","508008"],
        "水利": ["180901","180902"],
    }.items():
        for c in codes:
            industry_map[c] = ind
    
    # Load data
    try:
        with open(DATA_DIR / 'p0_discount_rates.json') as f:
            dr_data = json.load(f)
        with open(DATA_DIR / 'p0_extracted_params.json') as f:
            p0_data = json.load(f)
    except Exception:
        return {}
    
    asset_data = {}
    try:
        with open(DATA_DIR / 'assets.json') as f:
            assets_raw = json.load(f)
            funds = assets_raw.get('funds', assets_raw)  # Support both wrapped and unwrapped
            for code, entry in funds.items():
                if isinstance(entry, dict) and 'assets' in entry:
                    asset_data[code] = entry['assets']
    except Exception:
        pass
    
    cal_data = {}
    try:
        with open(DATA_DIR / 'comp_rents_calibrated.json') as f:
            cal_raw = json.load(f)
            cal_data = cal_raw.get('calibrations', {})
    except Exception:
        pass
    
    for code in sorted(set(list(dr_data.keys()) + list(p0_data.keys()))):
        industry = industry_map.get(code, "其他")
        
        # Discount rate
        dr_entry = dr_data.get(code, {})
        dr_vals = []
        if isinstance(dr_entry, dict):
            dr_vals = [d['value'] for d in dr_entry.get('discount_rates', []) if isinstance(d, dict)]
        dr_avg = round(sum(dr_vals)/len(dr_vals), 2) if dr_vals else None
        
        # Cap rate
        p0_entry = p0_data.get(code, {})
        cap_vals = []
        rg_vals = []
        tg_vals = []
        if isinstance(p0_entry, dict):
            cap_vals = [c['value'] for c in p0_entry.get('cap_rates', []) if isinstance(c, dict)]
            rg_vals = [c['value'] for c in p0_entry.get('rent_growth_rates', []) if isinstance(c, dict)]
            tg_vals = [c['value'] for c in p0_entry.get('terminal_growth_rates', []) if isinstance(c, dict)]
        
        cap_avg = round(sum(cap_vals)/len(cap_vals), 2) if cap_vals else None
        rg_avg = round(sum(rg_vals)/len(rg_vals), 2) if rg_vals else None
        tg_avg = round(sum(tg_vals)/len(tg_vals), 2) if tg_vals else None
        
        # Assets and fund name
        assets = asset_data.get(code, [])
        asset_names = [a.get('name', '') for a in assets if isinstance(a, dict)]
        asset_cities = list(set(a.get('city', '') for a in assets if isinstance(a, dict) and a.get('city')))
        asset_count = len(assets)
        
        # Try to get fund name from raw assets data
        fund_name = ''
        try:
            with open(DATA_DIR / 'assets.json') as f:
                raw = json.load(f)
                fe = raw.get('funds', {}).get(code, {})
                if isinstance(fe, dict):
                    fund_name = fe.get('fund_name', '') or fe.get('short_name', '')
        except Exception:
            pass
        
        # D-6/D-7
        cal = cal_data.get(code, {})
        
        # Search keywords
        keywords = [code, industry, fund_name] + asset_names + asset_cities
        
        _reits_index[code] = {
            "fund_code": code,
            "industry": industry,
            "asset_count": asset_count,
            "asset_names": asset_names[:3],  # Top 3 for display
            "cities": asset_cities[:3],
            "discount_rate": dr_avg,
            "cap_rate": cap_avg,
            "rent_growth_rate": rg_avg,
            "terminal_growth_rate": tg_avg,
            "discount_rate_samples": len(dr_vals),
            "cap_rate_samples": len(cap_vals),
            "d6_premium_pct": cal.get('d6_premium_pct'),
            "d7_signal": cal.get('d7_signal'),
            "d7_spread_pct": cal.get('d7_spread_pct'),
            "_keywords": " ".join(keywords).lower(),
        }
    
    return _reits_index


# ─── Page Routes ───
# Serve React SPA from static_spa (built from xiaohaiagent_frontend)
SPA_DIR = BASE_DIR / 'static_spa'

@app.route('/')
def index():
    return send_from_directory(str(SPA_DIR), 'index.html')

@app.route('/assets/<path:filename>')
def spa_assets(filename):
    return send_from_directory(str(SPA_DIR / 'assets'), filename)

@app.route('/<path:path>')
def spa_catch_all(path):
    # Only serve SPA for non-API paths
    if path.startswith('api/'):
        return jsonify({"error": "not found"}), 404
    # Try to serve the file, fallback to index.html for SPA routing
    file_path = SPA_DIR / path
    if file_path.exists() and file_path.is_file():
        return send_from_directory(str(SPA_DIR), path)
    return send_from_directory(str(SPA_DIR), 'index.html')

@app.route('/health')
def health():
    return jsonify({"status": "ok", "service": "COB-REval"})


# ─── API Routes ───

@app.route('/api/benchmark')
def api_benchmark():
    """消费类REITs对标数据"""
    try:
        with open(DATA_DIR / 'p0_discount_rates.json') as f:
            dr = json.load(f)
        with open(DATA_DIR / 'p0_extracted_params.json') as f:
            p0 = json.load(f)

        consumer_codes = [
            "180601","180602","180603","180604","180605","180606","180607",
            "508002","508005","508017","508082","508091","508600","508602","508603"
        ]

        discount_rates = []
        cap_rates = []
        for code in consumer_codes:
            dr_entry = dr.get(code, {})
            if isinstance(dr_entry, dict):
                dr_vals = [d['value'] for d in dr_entry.get('discount_rates', []) if isinstance(d, dict)]
                discount_rates.extend(dr_vals)
            p0_entry = p0.get(code, {})
            if isinstance(p0_entry, dict):
                cap_vals = [c['value'] for c in p0_entry.get('cap_rates', []) if isinstance(c, dict)]
                cap_rates.extend(cap_vals)

        from statistics import median
        return jsonify({
            "industry": "消费基础设施（购物中心/奥特莱斯）",
            "reits_count": len([c for c in consumer_codes if c in dr]),
            "discount_rate": {
                "median": round(median(discount_rates), 2) if discount_rates else 7.0,
                "min": round(min(discount_rates), 2) if discount_rates else 6.0,
                "max": round(max(discount_rates), 2) if discount_rates else 8.5,
                "samples": len(discount_rates),
            },
            "cap_rate": {
                "median": round(median(cap_rates), 2) if cap_rates else 5.8,
                "min": round(min(cap_rates), 2) if cap_rates else 5.0,
                "max": round(max(cap_rates), 2) if cap_rates else 7.0,
                "samples": len(cap_rates),
            },
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/upload', methods=['POST'])
def api_upload():
    """上传PDF并提取结构化信息"""
    if 'file' not in request.files:
        return jsonify({"error": "no_file"}), 400

    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "only_pdf"}), 400

    # Save uploaded file
    upload_path = UPLOAD_DIR / f"upload_{os.getpid()}.pdf"
    file.save(str(upload_path))

    try:
        # Extract info from PDF
        extraction = extract_from_pdf(str(upload_path))
        return jsonify(extraction)
    except Exception as e:
        return jsonify({"extraction_status": "failed", "extraction_error": str(e)}), 500
    finally:
        try:
            os.remove(str(upload_path))
        except Exception:
            pass


@app.route('/api/evaluate', methods=['POST'])
def api_evaluate():
    """接收项目参数，返回评估结果"""
    try:
        params = request.get_json(force=True)
        if not params:
            return jsonify({"error": "empty_body"}), 400
        
        # 若无city_tier，自动推断
        if 'city_tier' not in params or not params.get('city_tier'):
            from evaluation_engine import classify_city
            params['city_tier'] = classify_city(params.get('city', ''))

        result = evaluate_project(params)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "details": traceback.format_exc()}), 500


@app.route('/api/board', methods=['POST'])
def api_board():
    """接收项目参数，返回HTML评估展板"""
    try:
        params = request.get_json(force=True)
        if 'city_tier' not in params or not params.get('city_tier'):
            from evaluation_engine import classify_city
            params['city_tier'] = classify_city(params.get('city', ''))
        
        result = evaluate_project(params)
        
        # Generate HTML board
        html = generate_board_html(result)
        return jsonify({"html": html})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def generate_board_html(r):
    """生成评估展板HTML"""
    s = r['score']
    e = r['eligibility']
    v2 = r['v2_valuation']
    v3 = r['v3_valuation']
    b = r['benchmarks']

    score_color = "#22c55e" if s['total'] >= 80 else "#eab308" if s['total'] >= 60 else "#f97316" if s['total'] >= 40 else "#ef4444"
    verdict_color = "#22c55e" if e['verdict'] == '建议发行' else "#eab308" if '条件' in e['verdict'] else "#ef4444"

    return f"""
<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:24px;max-width:800px;margin:0 auto}}
.header{{text-align:center;padding:20px 0;border-bottom:1px solid #1e293b;margin-bottom:24px}}
.title{{font-size:24px;font-weight:700;color:#f8fafc}}
.subtitle{{font-size:14px;color:#94a3b8;margin-top:4px}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}}
.card{{background:#1e293b;border-radius:12px;padding:20px}}
.card-title{{font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:12px}}
.score-circle{{width:100px;height:100px;border-radius:50%;border:4px solid {score_color};display:flex;align-items:center;justify-content:center;margin:8px auto}}
.score-num{{font-size:36px;font-weight:700;color:{score_color}}}
.score-grade{{text-align:center;font-size:16px;font-weight:600;margin-top:8px;color:{score_color}}}
.metric-row{{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #334155}}
.metric-label{{color:#94a3b8;font-size:13px}}
.metric-value{{font-weight:600;font-size:14px}}
.verdict{{text-align:center;font-size:18px;font-weight:700;padding:8px;border-radius:8px;background:rgba({verdict_color.replace('#','')},0.15);color:{verdict_color}}}
.check-item{{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px}}
.check-pass{{color:#22c55e}}
.check-fail{{color:#ef4444}}
.valuation-box{{text-align:center;padding:12px;background:#0f172a;border-radius:8px;margin-top:8px}}
.valuation-num{{font-size:28px;font-weight:700;color:#38bdf8}}
.valuation-label{{font-size:11px;color:#64748b;margin-top:4px}}
.progress-bar{{height:6px;border-radius:3px;background:#334155;margin-top:4px}}
.progress-fill{{height:6px;border-radius:3px}}
.footer{{text-align:center;margin-top:24px;font-size:11px;color:#475569}}
.three-col{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}
.three-val{{text-align:center;padding:8px;background:#0f172a;border-radius:8px}}
.three-num{{font-size:18px;font-weight:600}}
.three-label{{font-size:11px;color:#64748b}}
</style></head><body>
<div class="header"><div class="title">🏢 {r['project_name']}</div><div class="subtitle">{r['city']} · {r['city_tier']}城市 · {int(r['area_sqm']):,}㎡ · COB-REval资产评价系统</div></div>

<div class="grid2">
<div class="card">
  <div class="card-title">综合评分</div>
  <div class="score-circle"><span class="score-num">{int(s['total'])}</span></div>
  <div class="score-grade">{s['grade']}</div>
  <div style="margin-top:12px">
    {"".join(f'<div class="metric-row"><span class="metric-label">{k}</span><span class="metric-value">{v["score"]:.0f}/{v["max"]}</span></div>' for k,v in s['details'].items())}
  </div>
</div>
<div class="card">
  <div class="card-title">发行条件评估</div>
  <div class="verdict">{e['verdict']} ({e['passed']}/{e['total']})</div>
  {"".join(f'<div class="check-item"><span class="{"check-pass" if c["pass"] else "check-fail"}">{"✅" if c["pass"] else "❌"}</span><span style="color:#94a3b8;font-size:12px">{c["detail"]}</span></div>' for c in e['checks'])}
</div>
</div>

<div class="card" style="margin-bottom:16px">
  <div class="card-title">估值分析</div>
  <div class="three-col">
    <div class="three-val"><div class="three-num" style="color:#38bdf8">{v2['best_yi']:.1f}亿</div><div class="three-label">V2 合理估值</div></div>
    <div class="three-val"><div class="three-num" style="color:#a78bfa">{v3['neutral_yi']:.1f}亿</div><div class="three-label">V3 中性估值</div></div>
    <div class="three-val"><div class="three-num" style="color:#f472b6">{r['cap_rate_used']}%</div><div class="three-label">Cap Rate</div></div>
  </div>
  <div class="metric-row" style="margin-top:12px"><span class="metric-label">V2方法</span><span class="metric-value" style="font-size:11px">{v2['method']}</span></div>
  <div class="metric-row"><span class="metric-label">V3方法</span><span class="metric-value" style="font-size:11px">{v3['method']}</span></div>
  <div class="metric-row"><span class="metric-label">V3区间</span><span class="metric-value">{v3['pessimistic_yi']:.1f} - {v3['optimistic_yi']:.1f}亿</span></div>
</div>

<div class="card">
  <div class="card-title">消费类REITs行业对标</div>
  <div class="metric-row"><span class="metric-label">对标REITs数</span><span class="metric-value">{b['comparable_reits_count']}只</span></div>
  <div class="metric-row"><span class="metric-label">折现率区间</span><span class="metric-value">{b['discount_rate_range'][0]}% - {b['discount_rate_range'][1]}%</span></div>
  <div class="metric-row"><span class="metric-label">Cap Rate区间</span><span class="metric-value">{b['cap_rate_range'][0]}% - {b['cap_rate_range'][1]}%</span></div>
  <div class="metric-row"><span class="metric-label">可比租金REITs</span><span class="metric-value">{'，'.join(c['code'][:6] for c in b['comparable_reits'][:5])}</span></div>
</div>

<div class="footer">COB-REval · 基于15只消费类上市REITs真实数据 · 评估结果仅供参考</div>
</body></html>"""


@app.route('/api/reits/search')
def api_reits_search():
    """搜索REITs — 支持基金代码、资产名、城市、行业"""
    try:
        q = (request.args.get('q', '') or '').strip().lower()
        idx = _load_reits_index()
        
        if not q:
            # Return all REITs
            results = [{k: v for k, v in entry.items() if not k.startswith('_')} 
                       for entry in sorted(idx.values(), key=lambda x: x['fund_code'])]
            return jsonify({"total": len(results), "results": results})
        
        # Fuzzy search
        results = []
        for entry in idx.values():
            score = 0
            kw = entry['_keywords']
            if q in entry['fund_code']:
                score += 100
            if q in entry['industry']:
                score += 50
            if q in kw:
                score += len(q) / len(kw) * 20
                # Bonus for exact match in asset/city names
                for name in entry.get('asset_names', []):
                    if q in name:
                        score += 30
                for city in entry.get('cities', []):
                    if q in city:
                        score += 25
            
            if score > 0:
                r = {k: v for k, v in entry.items() if not k.startswith('_')}
                r['_score'] = round(score, 1)
                results.append(r)
        
        results.sort(key=lambda x: x['_score'], reverse=True)
        # Remove score from output
        for r in results:
            r.pop('_score', None)
        
        return jsonify({"total": len(results), "query": q, "results": results[:20]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/reits/<code>')
def api_reits_detail(code):
    """获取单只REIT完整详情"""
    try:
        idx = _load_reits_index()
        entry = idx.get(code)
        if not entry:
            return jsonify({"error": "not_found", "code": code}), 404
        
        # Load full asset details
        assets_detail = []
        try:
            with open(DATA_DIR / 'assets.json') as f:
                assets_raw = json.load(f)
                funds = assets_raw.get('funds', assets_raw)
                asset_entry = funds.get(code, {})
                if isinstance(asset_entry, dict):
                    for a in asset_entry.get('assets', []):
                        if isinstance(a, dict):
                            assets_detail.append({
                                "name": a.get('name', ''),
                                "city": a.get('city', ''),
                                "area_sqm": a.get('building_area_sqm') or a.get('leasable_area_sqm'),
                                "valuation_v1": a.get('valuation_v1'),
                                "note": a.get('note', ''),
                            })
        except Exception:
            pass
        
        # Build detail response
        detail = {k: v for k, v in entry.items() if not k.startswith('_')}
        detail['assets'] = assets_detail
        
        # Add industry benchmarks
        industry = detail['industry']
        same_industry = [v for v in idx.values() if v['industry'] == industry]
        if same_industry:
            drs = [v['discount_rate'] for v in same_industry if v['discount_rate']]
            caps = [v['cap_rate'] for v in same_industry if v['cap_rate']]
            from statistics import median
            detail['industry_benchmarks'] = {
                "reits_count": len(same_industry),
                "discount_rate_median": round(median(drs), 2) if drs else None,
                "cap_rate_median": round(median(caps), 2) if caps else None,
            }
        
        return jsonify(detail)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/reits/board', methods=['POST'])
def api_reits_board():
    """生成REITs详情展板HTML"""
    try:
        params = request.get_json(force=True)
        code = params.get('code', '')
        if not code:
            return jsonify({"error": "code_required"}), 400
        
        idx = _load_reits_index()
        entry = idx.get(code)
        if not entry:
            return jsonify({"error": "not_found"}), 404
        
        # Get full detail
        detail_resp = api_reits_detail(code)
        import json as _json
        detail = _json.loads(detail_resp.data)
        
        html = _generate_reit_board_html(detail)
        return jsonify({"html": html})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _generate_reit_board_html(d):
    """生成REITs详情展板"""
    code = d.get('fund_code', '')
    ind = d.get('industry', '')
    dr = d.get('discount_rate')
    cap = d.get('cap_rate')
    rg = d.get('rent_growth_rate')
    tg = d.get('terminal_growth_rate')
    d6 = d.get('d6_premium_pct')
    d7 = d.get('d7_signal', '')
    assets = d.get('assets', [])
    ib = d.get('industry_benchmarks', {})
    
    ind_colors = {
        "消费": "#f472b6", "产业园": "#38bdf8", "仓储物流": "#a78bfa",
        "保租房": "#34d399", "高速公路": "#fbbf24", "能源": "#fb923c",
        "环保": "#22c55e", "水利": "#60a5fa",
    }
    ind_color = ind_colors.get(ind, "#94a3b8")
    
    params_html = "".join([
        f'<div class="ri-row"><span class="ri-label">折现率</span><span class="ri-value" style="color:#38bdf8">{dr}%</span></div>' if dr else '',
        f'<div class="ri-row"><span class="ri-label">Cap Rate</span><span class="ri-value" style="color:#a78bfa">{cap}%</span></div>' if cap else '',
        f'<div class="ri-row"><span class="ri-label">租金增长率</span><span class="ri-value">{rg}%</span></div>' if rg else '',
        f'<div class="ri-row"><span class="ri-label">终值增长率</span><span class="ri-value">{tg}%</span></div>' if tg else '',
    ])
    
    d67_html = ""
    if d6 is not None:
        d6_color = "#22c55e" if -10 <= d6 <= 10 else "#eab308" if -20 <= d6 <= 20 else "#ef4444"
        d67_html += f'<div class="ri-row"><span class="ri-label">D-6 溢价率</span><span class="ri-value" style="color:{d6_color}">{d6:+.1f}%</span></div>'
    if d7:
        d67_html += f'<div class="ri-row"><span class="ri-label">D-7 离散度</span><span class="ri-value" style="font-size:12px">{d7}</span></div>'
    
    assets_html = ""
    if assets:
        assets_html = '<div class="ri-section-title">🏗️ 底层资产</div>'
        for a in assets[:10]:
            name = a.get('name', '')[:40]
            city = a.get('city', '')
            area = a.get('area_sqm')
            v1 = a.get('valuation_v1')
            area_str = f"{int(area):,}㎡" if area else ""
            val_str = f"V1: {v1/100000000:.1f}亿" if v1 else ""
            assets_html += f'<div class="ri-asset">{name}<br><span style="font-size:11px;color:#64748b">{city} {area_str} {val_str}</span></div>'
    
    ib_html = ""
    if ib:
        ib_html = f"""
        <div class="ri-section-title">📊 行业对标 ({ind} · {ib.get('reits_count','')}只)</div>
        <div class="ri-row"><span class="ri-label">行业折现率中位</span><span class="ri-value">{ib.get('discount_rate_median','')}%</span></div>
        <div class="ri-row"><span class="ri-label">行业Cap Rate中位</span><span class="ri-value">{ib.get('cap_rate_median','')}%</span></div>
        """
    
    return f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:20px;max-width:750px;margin:0 auto}}
.header{{display:flex;align-items:center;gap:12px;padding:16px 0;border-bottom:1px solid #1e293b;margin-bottom:20px}}
.header-code{{font-size:24px;font-weight:700;color:#f8fafc}}
.header-badge{{display:inline-block;padding:2px 12px;border-radius:20px;font-size:12px;font-weight:600;background:{ind_color};color:#0f172a}}
.grid2{{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}}
.card{{background:#1e293b;border-radius:12px;padding:20px}}
.card-title{{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:14px}}
.ri-row{{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #334155}}
.ri-row:last-child{{border-bottom:none}}
.ri-label{{color:#94a3b8;font-size:13px}}
.ri-value{{font-weight:600;font-size:14px}}
.ri-section-title{{font-size:13px;font-weight:600;color:#e2e8f0;margin:14px 0 8px;padding-top:12px;border-top:1px solid #334155}}
.ri-asset{{padding:8px;background:#0f172a;border-radius:6px;margin-bottom:6px;font-size:12px;line-height:1.6}}
.footer{{text-align:center;margin-top:20px;font-size:11px;color:#475569}}
</style></head><body>
<div class="header">
  <div class="header-code">{code}</div>
  <div class="header-badge">{ind}</div>
  <div style="flex:1"></div>
  <div style="font-size:12px;color:#64748b">{d.get('asset_count','')}项资产</div>
</div>

<div class="grid2">
<div class="card">
  <div class="card-title">DCF 核心参数</div>
  {params_html or '<div style="color:#64748b;font-size:12px">暂无参数数据</div>'}
</div>
<div class="card">
  <div class="card-title">市场调和信号</div>
  {d67_html or '<div style="color:#64748b;font-size:12px">暂无D-6/D-7数据</div>'}
</div>
</div>

<div class="card">{assets_html}</div>
<div class="card">{ib_html}</div>

<div class="footer">COB-REval · REITs详情展板 · 数据基于招募说明书及二级市场公开信息</div>
</body></html>"""


# ─── Price data (module-level cache) ───

_PRICE_CSV_PATH = '/Users/pyemini/REITs/_archive_from_old_platform/research/outputs/reits_daily_history.csv'

@functools.lru_cache(maxsize=1)
def _load_price_data():
    """加载全部REITs日线历史数据（缓存）"""
    data: dict[str, list] = {}
    try:
        with open(_PRICE_CSV_PATH, newline='', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                fc = (row.get('fund_code') or '').strip()
                td = (row.get('trade_date') or '').strip()
                close_raw = (row.get('close') or '').strip()
                if not fc or not td or not close_raw:
                    continue
                close_val = float(close_raw)
                date_str = td[:10]
                if fc not in data:
                    data[fc] = []
                data[fc].append({'date': date_str, 'close': round(close_val, 3)})
    except Exception as e:
        print(f'Failed to load price data: {e}')
    return data


@app.route('/api/reits/price/<code>')
def api_reits_price(code):
    """获取REITs历史价格数据"""
    try:
        price_data = _load_price_data()

        results = price_data.get(code) or price_data.get(f'{code}.SZ') or price_data.get(f'{code}.SH')

        if results is None:
            for key in price_data:
                if key.startswith(code):
                    results = price_data[key]
                    break

        if not results:
            return jsonify({'error': 'no_price_data', 'code': code}), 404

        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── C-REITs 指数 ───

@functools.lru_cache(maxsize=1)
def _compute_creits_index():
    """计算C-REITs等权重指数（以最新交易日为100倒退计算）"""
    price_data = _load_price_data()
    if not price_data:
        return []

    # 按基金代码分组，每组按日期排序
    fund_series = {}
    for fc, rows in price_data.items():
        if not rows:
            continue
        sorted_rows = sorted(rows, key=lambda r: r['date'])
        # 过滤交易日不足20天的REIT
        if len(sorted_rows) < 20:
            continue
        # 计算每日收益率
        returns_by_date = {}
        for i in range(1, len(sorted_rows)):
            prev_close = sorted_rows[i - 1]['close']
            if prev_close and prev_close > 0:
                r = (sorted_rows[i]['close'] - prev_close) / prev_close
                returns_by_date[sorted_rows[i]['date']] = r
        fund_series[fc] = returns_by_date

    if not fund_series:
        return []

    # 收集所有有收益率的交易日
    all_dates = set()
    for rets in fund_series.values():
        all_dates.update(rets.keys())
    sorted_dates = sorted(all_dates)

    # 每个交易日等权平均收益率
    avg_returns = {}
    for d in sorted_dates:
        vals = []
        for rets in fund_series.values():
            if d in rets:
                vals.append(rets[d])
        if vals:
            avg_returns[d] = sum(vals) / len(vals)

    if not avg_returns:
        return []

    # 以最后一个交易日为100，倒退计算指数
    last_date = sorted_dates[-1]
    index_map = {last_date: 100.0}
    for d in reversed(sorted_dates):
        if d == last_date:
            continue
        ret = avg_returns.get(d)
        # 下一日指数
        next_date = None
        # 找到紧接的下一个交易日
        for nd in sorted_dates:
            if nd > d:
                next_date = nd
                break
        if next_date and next_date in index_map and ret is not None:
            index_map[d] = round(index_map[next_date] / (1 + ret), 2)
        elif next_date and next_date in index_map:
            index_map[d] = index_map[next_date]

    # 按日期排序输出
    result = [{"date": d, "index": index_map[d]} for d in sorted_dates if d in index_map]
    return result


@app.route('/api/reits/c-reits-index')
def api_creits_index():
    """C-REITs等权重指数"""
    try:
        data = _compute_creits_index()
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── REITs Dashboard ───

_REITS_DB_PATH = '/Users/pyemini/REITs/REITs-quant/data/reits_info.db'
_PIPELINE_DIR = '/Users/pyemini/REITs/REITs_Text_data_pipeline/RAG-REITsTextFlow/announcement_document_processing_local'


@functools.lru_cache(maxsize=1)
def _build_dashboard_data():
    db = sqlite3.connect(_REITS_DB_PATH)
    rows = db.execute("SELECT code,name,project_type,list_date,scale FROM reits_basic").fetchall()
    db.close()

    # Count scanned docs from pipeline disk
    scanned_counts = {}
    if os.path.isdir(_PIPELINE_DIR):
        for code_dir in os.listdir(_PIPELINE_DIR):
            dpath = os.path.join(_PIPELINE_DIR, code_dir)
            if os.path.isdir(dpath):
                count = 0
                for doc_dir in os.listdir(dpath):
                    ddoc = os.path.join(dpath, doc_dir)
                    if os.path.isdir(ddoc) and os.path.exists(os.path.join(ddoc, 'meta.json')):
                        count += 1
                scanned_counts[code_dir] = count

    price_data = _load_price_data()

    reits_list = []
    for code, name, ptype, list_date, scale in rows:
        code_6 = code.replace('.SZ', '').replace('.SH', '')
        scanned = scanned_counts.get(code_6, 0)

        # Latest price from CSV
        prices = price_data.get(code, [])
        latest_price = prices[-1]['close'] if prices else None
        prev_price = prices[-2]['close'] if len(prices) > 1 else latest_price
        change_pct = round((latest_price - prev_price) / prev_price * 100, 2) if latest_price and prev_price and prev_price > 0 else 0

        reits_list.append({
            'code': code, 'name': name, 'type': ptype,
            'list_date': list_date or '', 'scale': scale or '',
            'price': latest_price, 'change': f'{change_pct:+.2f}%',
            'positive': change_pct >= 0,
            'scanned_docs': scanned,
        })

    # Sort: 180607 first, then by type, then by code
    reits_list.sort(key=lambda x: (0 if '180607' in x['code'] else 1, x['type'], x['code']))

    total_reits = len(set(c for c in scanned_counts if scanned_counts[c] > 0))
    total_docs = sum(scanned_counts.values())

    return {
        'total_reits': total_reits,
        'total_docs': total_docs,
        'market_stats': [
            {'label': '已入库REITs', 'value': str(total_reits), 'unit': '只'},
            {'label': '已扫描公告', 'value': str(total_docs), 'unit': '份'},
            {'label': '消费REITs', 'value': str(sum(1 for r in reits_list if '消费' in r['type'])), 'unit': '只'},
        ],
        'reits': reits_list,
    }


@app.route('/api/reits/dashboard')
def api_reits_dashboard():
    try:
        return jsonify(_build_dashboard_data())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    print("COB-REval starting on http://0.0.0.0:8080")
    app.run(host='0.0.0.0', port=8080, debug=False)
