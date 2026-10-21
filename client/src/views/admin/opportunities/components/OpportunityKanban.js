import { Box, Button, Flex, Select, Text } from '@chakra-ui/react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { createPortal } from 'react-dom';
import { FiArrowUpRight, FiBriefcase, FiCalendar, FiCheckCircle, FiColumns, FiGrid, FiLayers, FiUser, FiXCircle } from 'react-icons/fi';
import { tr } from 'i18n/runtime';

export const defaultSalesStages = ['Prospecting', 'Qualification', 'Needs Analysis', 'Value Proposition',
  'Identifying Decision Makers', 'Perception Analysis', 'Proposal/Price Quote', 'Negotiation/Review', 'Closed/Won', 'Closed/Lost']
  .map(value => ({ value, label: value }));
export const stageValue = record => typeof record.salesStage === 'object' ? record.salesStage?.value || '' : record.salesStage || '';

const tones = ['blue', 'violet', 'amber', 'cyan', 'rose'];
const stageTone = (value, index) => /(^|[/\s])won$/i.test(value) ? 'green'
  : /(^|[/\s])lost$/i.test(value) ? 'rose' : tones[index % tones.length];
const locale = () => ({ fa: 'fa-IR', tr: 'tr-TR' }[localStorage.getItem('crm-language')] || 'en-US');
const formatAmount = record => {
  const amount = record.opportunityAmount === '' || record.opportunityAmount == null ? record.amount : record.opportunityAmount;
  if (amount === '' || amount == null || !Number.isFinite(Number(amount))) return null;
  const currency = record.currency === '$' ? 'USD' : (record.currency || 'TRY').toUpperCase();
  try {
    return new Intl.NumberFormat(locale(), { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount));
  } catch {
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(Number(amount)) + ' ' + currency;
  }
};
const closeDate = value => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale(), { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date) : null;
};

export default function OpportunityKanban({ records = [], stages = [], canMove, savingId, onStageChange, onView }) {
  const card = (record, tone, dragging = false) => {
    const amount = formatAmount(record);
    const date = closeDate(record.expectedCloseDate);
    const assigned = typeof record.assignUserName === 'string' ? record.assignUserName : '';
    return <Box className={'crm-opportunity-card' + (dragging ? ' is-dragging' : '')} data-tone={tone}
      aria-busy={savingId === record._id}>
      <Flex className="crm-opportunity-card__eyebrow" justify="space-between" align="center">
        <Text className="crm-opportunity-card__type"><FiBriefcase aria-hidden="true" />{tr('Opportunity')}</Text>
        <FiGrid className="crm-opportunity-card__grip" aria-hidden="true" />
      </Flex>
      <Button className="crm-opportunity-card__title" variant="unstyled" onClick={() => onView(record._id)}>
        <span>{record.opportunityName || tr('Untitled')}</span><FiArrowUpRight aria-hidden="true" />
      </Button>
      {(record.contactName || record.accountName2) && <Box className="crm-opportunity-card__details">
        {record.contactName && <Text><FiUser aria-hidden="true" /><span>{record.contactName}</span></Text>}
        {record.accountName2 && record.accountName2 !== record.contactName && <Text><FiBriefcase aria-hidden="true" /><span>{record.accountName2}</span></Text>}
      </Box>}
      {amount !== null && <Box className="crm-opportunity-card__amount">
        <Text>{tr('pipeline.dealValue')}</Text><Text data-no-translate dir="auto">{amount}</Text>
      </Box>}
      {(date || assigned) && <Flex className="crm-opportunity-card__meta" wrap="wrap">
        {assigned && <Text title={assigned}><FiUser aria-hidden="true" /><span>{assigned}</span></Text>}
        {date && <Text title={tr('Expected Close Date')}><FiCalendar aria-hidden="true" /><span>{date}</span></Text>}
      </Flex>}
      <Box className="crm-opportunity-card__footer">
        <Select size="sm" aria-label={tr('Sales Stage') + ': ' + (record.opportunityName || '')}
          value={stageValue(record)} isDisabled={!canMove(record) || savingId === record._id}
          onChange={event => onStageChange(record._id, event.target.value)}>
          {!stages.some(stage => stage.value === stageValue(record)) && <option value={stageValue(record)}>{tr('pipeline.noStage')}</option>}
          {stages.map(stage => <option key={stage.value} value={stage.value}>{tr(stage.label)}</option>)}
        </Select>
      </Box>
    </Box>;
  };
  const unknown = records.filter(record => !stages.some(stage => stage.value === stageValue(record)));
  return <Box className="crm-opportunity-board">
    <Flex className="crm-opportunity-board__intro" justify="space-between" align="center" gap={3} wrap="wrap">
      <Box><Text className="crm-opportunity-board__title"><FiColumns aria-hidden="true" />{tr('pipeline.salesPipeline')}</Text>
        <Text className="crm-opportunity-board__hint">{tr('pipeline.boardHint')}</Text></Box>
      <Text className="crm-opportunity-board__count">{stages.length.toLocaleString(locale())} {tr('pipeline.stages')}</Text>
    </Flex>
    <DragDropContext onDragEnd={({ draggableId, source, destination }) => {
      if (destination && source.droppableId !== destination.droppableId) onStageChange(draggableId, destination.droppableId);
    }}>
      <Box className="crm-opportunity-kanban">
        <Flex className="crm-opportunity-board__track">
          {stages.map((stage, stageIndex) => {
            const items = records.filter(record => stageValue(record) === stage.value);
            const tone = stageTone(stage.value, stageIndex);
            const StageIcon = tone === 'green' ? FiCheckCircle : /lost$/i.test(stage.value) ? FiXCircle : FiLayers;
            return <Box as="section" className="crm-opportunity-column" data-stage={stage.value} data-tone={tone}
              aria-label={tr(stage.label)} key={stage.value}>
              <Flex className="crm-opportunity-column__header" align="center" gap={3}>
                <Box className="crm-opportunity-column__icon"><StageIcon aria-hidden="true" /></Box>
                <Box flex="1" minW={0}><Text className="crm-opportunity-column__caption">{tr('Sales Stage')}</Text>
                  <Text as="h3" className="crm-opportunity-column__title">{tr(stage.label)}</Text></Box>
                <Text className="crm-opportunity-column__count">{items.length.toLocaleString(locale())}</Text>
              </Flex>
              <Droppable droppableId={stage.value}>
                {(provided, snapshot) => <Box ref={provided.innerRef} {...provided.droppableProps}
                  className={'crm-opportunity-column__body' + (snapshot.isDraggingOver ? ' is-over' : '')}>
                  {!items.length && !snapshot.isDraggingOver && <Box className="crm-opportunity-column__empty">
                    <FiLayers aria-hidden="true" /><Text>{tr('pipeline.emptyStage')}</Text>
                    <Text>{tr('pipeline.emptyHint')}</Text>
                  </Box>}
                  {items.map((record, index) => <Draggable key={record._id} draggableId={String(record._id)} index={index}
                    isDragDisabled={!canMove(record) || savingId === record._id}>
                    {(drag, snapshot) => {
                      const element = <Box className="crm-opportunity-draggable" ref={drag.innerRef}
                        {...drag.draggableProps} {...drag.dragHandleProps}>{card(record, tone, snapshot.isDragging)}</Box>;
                      return snapshot.isDragging ? createPortal(element, document.body) : element;
                    }}
                  </Draggable>)}
                  {provided.placeholder}
                </Box>}
              </Droppable>
            </Box>;
          })}
        </Flex>
      </Box>
    </DragDropContext>
    {!!unknown.length && <Box className="crm-opportunity-unassigned">
      <Text as="h3"><FiLayers aria-hidden="true" />{tr('pipeline.noStage')} <span>{unknown.length.toLocaleString(locale())}</span></Text>
      <Flex gap={4} flexWrap="wrap">{unknown.map(record => <Box key={record._id} width="300px" maxW="100%">{card(record, 'blue')}</Box>)}</Flex>
    </Box>}
  </Box>;
}
