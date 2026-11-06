"use client";

import { useState } from "react";
import { useApp } from "@/components/AppContext";
import { Field, PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

export default function ProductsPage() {
  const { products, activeId, setActiveId, run, reloadBase } = useApp();
  const [name, setName] = useState("");
  const [launch, setLaunch] = useState("2027-03-26");
  const [type, setType] = useState("NEW");
  const [proc, setProc] = useState("표준");

  return (
    <>
      <PageHeader title="제품 관리" desc="품명은 「제품A」처럼 바꿔 씁니다. 공휴일이 등록되지 않은 연도에 출시하는 제품은 만들 수 없습니다(C-05)." />

      <Panel title="제품 추가">
        <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => api.createProduct({ name, launch_date: launch, product_type: type, process: proc }));
          if (r) { setName(""); reloadBase(); }
        }}>
          <Field label="이름"><input required placeholder="제품C" value={name} onChange={(e) => setName(e.target.value)} className="input w-44" /></Field>
          <Field label="출시일"><input required type="date" value={launch} onChange={(e) => setLaunch(e.target.value)} className="input num" /></Field>
          <Field label="유형">
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {["NEW", "리뉴얼", "NPB", "기획세트"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="프로세스">
            <select value={proc} onChange={(e) => setProc(e.target.value)} className="input">
              {["표준", "QUICK"].map((v) => <option key={v}>{v}</option>)}
            </select>
          </Field>
          <button className="btn">제품 추가</button>
        </form>
        <p className="mt-3 text-xs text-faint">
          지금 Task 기준 데이터는 NEW|표준 한 벌뿐이라 유형과 프로세스는 기록만 하고 일정 계산에는 쓰지 않습니다. 정본 시트가 정해지면(D-08) 반영합니다.
        </p>
      </Panel>

      <Panel pad={false} title={<>등록 제품 <span className="num ml-1 font-normal text-muted">{products.length}개</span></>}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>이름</th><th>출시일</th><th>유형</th><th>프로세스</th><th>화면 대상</th><th className="text-right">관리</th></tr></thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-ink">{p.name}</td>
                  <td className="num">{p.launch_date}</td>
                  <td>{p.product_type}</td>
                  <td>{p.process}</td>
                  <td>
                    {p.id === activeId
                      ? <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />보는 중</span>
                      : <button className="btn-quiet" onClick={() => setActiveId(p.id)}>이 제품 보기</button>}
                  </td>
                  <td className="text-right">
                    <button className="btn-quiet hover:!bg-bad-soft hover:!text-bad" onClick={async () => {
                      if (confirm(`${p.name}과 입력한 실적을 삭제할까요?`)) { await run(() => api.deleteProduct(p.id)); reloadBase(); }
                    }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
