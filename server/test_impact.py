import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app.services.impact_analysis_service import ImpactAnalysisService

svc = ImpactAnalysisService()

# Test 1: File impact - fastapi/routing.py (should have high impact)
print("=" * 60)
print("FILE IMPACT: fastapi/routing.py")
print("=" * 60)

result = svc.analyze_file('fastapi', 'fastapi/routing.py')
impact = result['impact']

print("Blast Radius:          ", impact['blast_radius'])
print("Total Affected Files:  ", impact['total_affected_files'])
print("Total Affected Fns:    ", impact['total_affected_functions'])
print("Total Affected Flows:  ", impact['total_affected_workflows'])
print("Affected Layers:       ", impact['affected_layers'])

print()
print("Direct Dependents (first 5):")
for dep in impact['direct_dependents'][:5]:
    print(" -", dep['file'], "->", dep['imports_module'])

print()
print("Affected Workflows (first 5):")
for wf in impact['affected_workflows'][:5]:
    name = wf['workflow']
    fns = wf['functions_called_in_target']
    print(" -", name, "| calls:", fns)

print()
print("=" * 60)
print("FUNCTION IMPACT: include_router")
print("=" * 60)

result2 = svc.analyze_function('fastapi', 'include_router')
impact2 = result2['impact']

print("Blast Radius:          ", impact2['blast_radius'])
print("Total Callers:         ", impact2['total_affected_functions'])
print("Total Affected Flows:  ", impact2['total_affected_workflows'])
print("Affected Layers:       ", impact2['affected_layers'])

print()
print("Direct Callers (first 5):")
for c in impact2['direct_callers'][:5]:
    print(" -", c['caller_id'])
