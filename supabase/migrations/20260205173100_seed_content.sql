-- Seed minimal micro-lessons (ES/EU) for MVP
insert into public.content_lessons (slug, title_es, body_es, title_eu, body_eu, duration_sec, tags, published)
values
('hidrata-1', 'Hidratación simple', 'Empieza con 1 vaso de agua al levantarte. No es perfección: es constancia.', 'Hidratazio sinplea', 'Hasi eguna esnatzean ur baso batekin. Ez da perfekzioa: jarraitutasuna da.', 70, array['habitos'], true),
('proteina-1', 'Proteína sin complicarte', 'Elige 1 fuente de proteína por comida. Si dudas, prioriza lo más fácil hoy.', 'Proteina erraz', 'Aukeratu proteina iturri 1 otordu bakoitzean. Zalantzan bazaude, gaur errazena lehenetsi.', 80, array['plan'], true),
('fuera-casa-1', 'Fuera de casa (sin culpa)', 'En restaurante: pide 1 “ancla” (proteína o verdura) y disfruta el resto.', 'Etxetik kanpo (errurik gabe)', 'Jatetxean: eskatu “aingura” 1 (proteina edo barazkia) eta gainerakoa lasai gozatu.', 75, array['social'], true),
('snacks-1', 'Snacks con intención', 'Si picas, que sea una decisión. 1 snack planificado reduce el caos.', 'Snackak intentzioz', 'Jaten baduzu, erabaki bat izan dadila. Planifikatutako snack 1ek kaosa murrizten du.', 75, array['habitos'], true),
('digestivo-1', 'Digestivo: mira la semana', 'No te juzgues por un día. Observa tendencias semanales y compártelas.', 'Digestiboa: astea begiratu', 'Ez epaitu egun bakarragatik. Begiratu asteko joerak eta partekatu.', 80, array['digestivo'], true),
('plan-a-b-1', 'Plan A / Plan B', 'Tener alternativas no es “fallar”: es diseñar para la vida real.', 'A plana / B plana', 'Alternatibak edukitzea ez da “huts egitea”: bizitza errealerako diseinatzea da.', 70, array['plan'], true),
('checkin-1', 'Check-in rápido', 'Marca “cumplí / a medias / no” y un motivo. Eso ya ayuda a ajustar el plan.', 'Check-in azkarra', 'Markatu “egin dut / erdizka / ez” eta arrazoi bat. Horrek plana doitzen laguntzen du.', 75, array['registro'], true),
('hambre-1', 'Hambre vs. antojo', 'Haz una pausa de 10 segundos: ¿hambre física o ganas emocionales?', 'Gosea vs. gogoa', '10 segundo gelditu: gose fisikoa ala gogo emozionala?', 75, array['mindful'], true),
('sueño-1', 'Sueño y decisiones', 'Dormir un poco peor no se arregla con fuerza de voluntad. Ajusta expectativas.', 'Loa eta erabakiak', 'Gutxiago lo egitea ez da borondatez konpontzen. Itxaropenak doitu.', 80, array['sueño'], true),
('estrés-1', 'Estrés: mini-acción', 'Si el día va rápido, elige 1 acción mínima del plan. Suma.', 'Estresa: mini-ekintza', 'Eguna azkar badoa, aukeratu planeko ekintza minimo 1. Gehitzen du.', 70, array['estres'], true),
('compra-1', 'Compra inteligente', 'Lista corta: 6–10 básicos que te resuelvan el 80% de la semana.', 'Erosketa adimentsua', 'Zerrenda laburra: 6–10 oinarri astean %80 konpontzeko.', 75, array['compra'], true),
('cocina-1', 'Cocina en lote (mínima)', 'Cocina 1 base (arroz/pasta/verduras) y reutilízala 2 veces.', 'Batch sukaldaritza (minimoa)', 'Prestatu oinarri 1 (arroza/pasta/barazkiak) eta erabili 2 aldiz.', 80, array['habitos'], true),
('social-1', 'Eventos sociales', 'Planifica 1 elección. Lo demás, sin culpa. Eso es adherencia real.', 'Gizarte ekitaldiak', 'Planifikatu hautu 1. Gainerakoa, errurik gabe. Hori da benetako atxikimendua.', 80, array['social'], true),
('peso-1', 'Peso (neutral)', 'El peso es un dato, no un juicio. Si te afecta, es opcional en la app.', 'Pisua (neutrala)', 'Pisua datu bat da, ez epai bat. Eragiten badizu, aukerakoa da app-ean.', 75, array['progreso'], true),
('victorias-1', 'Victorias pequeñas', 'Una victoria semanal cambia el foco: lo que funciona se repite.', 'Garaipen txikiak', 'Asteko garaipen batek fokua aldatzen du: funtzionatzen duena errepikatu.', 70, array['review'], true)
on conflict (slug) do nothing;

