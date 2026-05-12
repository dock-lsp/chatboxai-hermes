import {
  Anchor,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Image,
  Popover,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconChevronRight,
  IconClipboard,
  IconFileText,
  IconHome,
  IconMail,
  IconMessage2,
  IconPencil,
} from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { Fragment, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import BrandGithub from '@/components/icons/BrandGithub'
import BrandRedNote from '@/components/icons/BrandRedNote'
import BrandWechat from '@/components/icons/BrandWechat'
import Page from '@/components/layout/Page'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import platform from '@/platform'
import iconPNG from '@/static/icon.png'
import IMG_WECHAT_QRCODE from '@/static/wechat_qrcode.png'
import { useLanguage } from '@/stores/settingsStore'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()
  const version = useVersion()
  const isSmallScreen = useIsSmallScreen()

  return (
    <Page title={t('About')}>
      <Container size="md" p={0}>
        <Stack gap="xxl" px={isSmallScreen ? 'sm' : 'md'} py={isSmallScreen ? 'xl' : 'md'}>
          <Flex gap="xxl" p="md" className="rounded-lg bg-chatbox-background-secondary">
            <Image h={100} w={100} mah={'20vw'} maw={'20vw'} src={iconPNG} />
            <Stack flex={1} gap="xxs">
              <Flex justify="space-between" align="center" wrap="wrap" gap={isSmallScreen ? 'xs' : 'sm'} rowGap="xs">
                <Title order={5} lh={1.5} lineClamp={1} title={`Chatbox v${version.version}`}>
                  Chatbox {/\d/.test(version.version) ? `(v${version.version})` : ''}
                </Title>
              </Flex>
              <Text>{t('about-slogan')}</Text>
              <Text c="chatbox-tertiary">{t('about-introduction')}</Text>

              <Flex gap="sm">
                <Text size="sm" c="chatbox-tertiary">
                  {t('Privacy Policy')}
                </Text>
                <Text size="sm" c="chatbox-tertiary">
                  {t('User Terms')}
                </Text>
              </Flex>
            </Stack>
          </Flex>

          <List>
            <ListItem
              icon={<BrandGithub className="w-full h-full" />}
              title={t('Github')}
              link=""
              value="chatbox"
            />
            <ListItem
              icon={<BrandRedNote className="w-full h-full" />}
              title={t('RedNote')}
              link=""
              value="@63844903136"
            />
            <ListItem icon={<BrandWechat className="w-full h-full" />} title={t('WeChat')} right={<WechatQRCode />} />
          </List>

          <List>
            <ListItem
              icon={<IconHome className="w-full h-full" />}
              title={t('Homepage')}
              link=""
            />
            <ListItem
              icon={<IconClipboard className="w-full h-full" />}
              title={t('Survey')}
              link=""
            />
            <ListItem
              icon={<IconPencil className="w-full h-full" />}
              title={t('Feedback')}
              link=""
            />
            <ListItem
              icon={<IconFileText className="w-full h-full" />}
              title={t('Changelog')}
              link=""
            />
            <ListItem
              icon={<IconMail className="w-full h-full" />}
              title={t('E-mail')}
              link={`mailto:hi@chatboxai.com`}
              value="hi@chatboxai.com"
            />
            <ListItem
              icon={<IconMessage2 className="w-full h-full" />}
              title={t('FAQs')}
              link=""
            />
          </List>
        </Stack>
      </Container>
    </Page>
  )
}

function WechatQRCode() {
  const { t } = useTranslation()
  const [opened, { close, open }] = useDisclosure(false)
  return (
    <Popover position="top" withArrow shadow="md" opened={opened}>
      <Popover.Target>
        <Text onMouseEnter={open} onMouseLeave={close} c="chatbox-brand" className="cursor-pointer">
          {t('QR Code')}
        </Text>
      </Popover.Target>
      <Popover.Dropdown style={{ pointerEvents: 'none' }}>
        <Image src={IMG_WECHAT_QRCODE} alt="wechat qrcode" w={160} h={160} />
      </Popover.Dropdown>
    </Popover>
  )
}

function List(props: { children: ReactElement[] }) {
  return (
    <Stack gap={0} className="rounded-lg bg-chatbox-background-secondary">
      {props.children.map((child, index) => (
        <Fragment key={`child-${index}`}>
          {child}
          {index !== props.children.length - 1 && <Divider />}
        </Fragment>
      ))}
    </Stack>
  )
}

function ListItem({
  icon,
  title,
  link,
  value,
  right,
}: {
  icon: ReactElement
  title: string
  link?: string
  value?: string
  right?: ReactElement
}) {
  return (
    <Flex
      px="md"
      py="sm"
      gap="xs"
      align="center"
      className={link ? 'cursor-pointer' : ''}
      onClick={() => link && platform.openLink(link)}
      c="chatbox-tertiary"
    >
      <Box w={20} h={20} className="flex-shrink-0 " c="chatbox-primary">
        {icon}
      </Box>
      <Text flex={1} size="md">
        {title}
      </Text>

      {right ? (
        right
      ) : (
        <>
          {value && (
            <Text size="md" c="chatbox-tertiary">
              {value}
            </Text>
          )}
          {link && <ScalableIcon icon={IconChevronRight} size={20} className="!text-inherit" />}
        </>
      )}
    </Flex>
  )
}
