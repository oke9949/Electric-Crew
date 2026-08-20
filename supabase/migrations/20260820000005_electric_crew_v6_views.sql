do $$
begin
if to_regclass('public.project_dashboard') is null then
execute $view$
create view public.project_dashboard as
select p.*,
(select count(*) from public.systems s where s.project_id=p.id) as system_count,
(select count(*) from public.tasks t where t.project_id=p.id) as task_count
from public.projects p
$view$;
end if;
if to_regclass('public.system_dashboard') is null then
execute $view$
create view public.system_dashboard as
select s.*,p.company_id,p.project_code,p.name as project_name,
(select count(*) from public.tasks t where t.system_id=s.id) as task_count,
(select coalesce(sum(w.hours),0) from public.work_logs w where w.system_id=s.id) as logged_hours
from public.systems s join public.projects p on p.id=s.project_id
$view$;
end if;
end $$;
alter view public.project_dashboard set (security_invoker=true);
alter view public.system_dashboard set (security_invoker=true);
