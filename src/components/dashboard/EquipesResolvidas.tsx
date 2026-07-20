import { Badge, Group, Text } from '@mantine/core'
import type { EquipeResolvida } from '../../types/domain'
import { COR_POR_EQUIPE } from './tarefaApresentacao'
import classes from './GraficosInteligencia.module.css'

interface EquipesResolvidasProps {
  equipes: EquipeResolvida[]
  /** Fonte de onde os departamentos foram resolvidos (bx24 / webhook / mock). */
  fonte: string
}

/**
 * Tracking da modelagem de dados: mostra, para cada uma das equipes informadas,
 * se o ID de departamento configurado (DEPARTAMENTO_ID_POR_EQUIPE) existe de
 * fato na fonte real (o que a api_url busca). Uma equipe "não encontrada"
 * indica que o ID no código não bate com nenhum departamento do Bitrix.
 */
export function EquipesResolvidas({ equipes, fonte }: EquipesResolvidasProps) {
  return (
    <div className={`${classes.cartao} ${classes.cartaoLargo}`}>
      <Group justify="space-between" align="center" mb="xs">
        <Text className={classes.tituloCartao} fw={700}>
          Equipes informadas × departamentos do Bitrix
        </Text>
        <Badge variant="light" color="gray" size="sm">
          fonte: {fonte}
        </Badge>
      </Group>
      <Text className={classes.subtitulo} size="xs">
        Validação dos IDs de departamento das equipes contra os departamentos reais buscados na fonte.
      </Text>

      <Group gap="sm">
        {equipes.map((equipe) => (
          <Badge
            key={equipe.nome}
            size="lg"
            variant={equipe.encontrada ? 'filled' : 'outline'}
            color={equipe.encontrada ? undefined : 'red'}
            style={
              equipe.encontrada ? { backgroundColor: COR_POR_EQUIPE[equipe.nome] } : undefined
            }
          >
            {equipe.nome}
            {equipe.encontrada ? ` · #${equipe.departamentoId}` : ' · não encontrada'}
          </Badge>
        ))}
      </Group>
    </div>
  )
}
